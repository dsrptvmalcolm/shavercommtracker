-- Inventory phase 2: Marketplace alerts for the person who posted a car.
-- "Sold" = a posted car left the feed; "price_change" = a posted car's price changed.
-- Also: blank feed price = unchanged, one ingest at a time, porter guard in delete_deal.

create table public.inventory_alerts (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles (id),
  staff_id uuid not null references public.staff (id),
  kind text not null check (kind in ('sold', 'price_change')),
  old_price numeric(12, 2),
  new_price numeric(12, 2),
  created_at timestamptz not null default now(),
  dismissed_at timestamptz
);

create index inventory_alerts_open_idx on public.inventory_alerts (staff_id) where dismissed_at is null;
create index inventory_alerts_vehicle_idx on public.inventory_alerts (vehicle_id);

alter table public.inventory_alerts enable row level security;
create policy inventory_alerts_read on public.inventory_alerts for select to authenticated using (
  staff_id = (select public.my_staff_id()) or (select public.is_admin())
);

-- Ingest: identical to 0008 except
--   * one run at a time (cron + Refresh now can't interleave),
--   * a blank feed price keeps the stored price (no price_change event),
--   * alerts for the poster on price changes and departures.
-- Repeat price changes update the poster's open alert (first "from" price kept); a change back to that
-- price removes it. A departure dismisses the car's open price alerts and adds one sold alert.

create or replace function public.ingest_inventory(
  p_rows jsonb,
  p_force boolean default false,
  p_error text default null,
  p_rejected int default 0
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_staff uuid := public.my_staff_id();
  v_trigger text;
  v_started timestamptz := clock_timestamp();
  v_today date := (now() at time zone 'America/Chicago')::date;
  v_feed_count int;
  v_in_stock int;
  v_to_remove int;
  v_added int := 0;
  v_updated int := 0;
  v_price_changes int := 0;
  v_removed int := 0;
  v_returned int := 0;
  v_msg text;
  r jsonb;
  v public.vehicles;
  v_price numeric;
  v_poster uuid;
  v_alert_id uuid;
  v_alert_old numeric;
begin
  if not ((select public.is_admin()) or coalesce(auth.jwt() ->> 'role', '') = 'service_role') then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  -- A second caller waits here until the first run's transaction ends
  perform pg_advisory_xact_lock(hashtext('public.ingest_inventory'));
  v_trigger := case when v_staff is null then 'schedule' else 'manual' end;

  if p_error is not null then
    insert into public.inventory_runs (started_at, finished_at, status, trigger, triggered_by, rejected, message)
      values (v_started, clock_timestamp(), 'failed', v_trigger, v_staff, coalesce(p_rejected, 0), p_error);
    return jsonb_build_object('status', 'failed', 'added', 0, 'updated', 0, 'price_changes', 0,
      'removed', 0, 'returned', 0, 'message', p_error);
  end if;

  v_feed_count := coalesce(jsonb_array_length(p_rows), 0);
  if v_feed_count = 0 then
    v_msg := 'Feed had no vehicles — nothing changed';
    insert into public.inventory_runs (started_at, finished_at, status, trigger, triggered_by, rejected, message)
      values (v_started, clock_timestamp(), 'failed', v_trigger, v_staff, coalesce(p_rejected, 0), v_msg);
    return jsonb_build_object('status', 'failed', 'added', 0, 'updated', 0, 'price_changes', 0,
      'removed', 0, 'returned', 0, 'message', v_msg);
  end if;

  select count(*) into v_in_stock from public.vehicles where status = 'in_stock';
  select count(*) into v_to_remove from public.vehicles
    where status = 'in_stock'
      and vin not in (select upper(x ->> 'vin') from jsonb_array_elements(p_rows) x);

  if not p_force and v_in_stock > 0 and v_to_remove > 0.3 * v_in_stock then
    v_msg := format('Feed would remove %s of %s cars — not applied', v_to_remove, v_in_stock);
    insert into public.inventory_runs (started_at, finished_at, status, trigger, triggered_by, rejected, message)
      values (v_started, clock_timestamp(), 'stopped', v_trigger, v_staff, coalesce(p_rejected, 0), v_msg);
    return jsonb_build_object('status', 'stopped', 'added', 0, 'updated', 0, 'price_changes', 0,
      'removed', 0, 'returned', 0, 'message', v_msg);
  end if;

  for r in select * from jsonb_array_elements(p_rows) loop
    v_price := nullif(r ->> 'price', '')::numeric;
    select * into v from public.vehicles where vin = upper(r ->> 'vin');

    if not found then
      insert into public.vehicles (
        vin, stock_number, year, make, model, trim, body_style, drivetrain, transmission, fuel_type,
        mileage, price, first_price, exterior_color, interior_color, url, images, description_html,
        dealer_name, dealer_address, date_first_on_lot
      ) values (
        upper(r ->> 'vin'), upper(r ->> 'stock_number'), nullif(r ->> 'year', '')::int,
        coalesce(r ->> 'make', ''), coalesce(r ->> 'model', ''), coalesce(r ->> 'trim', ''),
        coalesce(r ->> 'body_style', ''), coalesce(r ->> 'drivetrain', ''), coalesce(r ->> 'transmission', ''),
        coalesce(r ->> 'fuel_type', ''), nullif(r ->> 'mileage', '')::int, v_price, v_price,
        coalesce(r ->> 'exterior_color', ''), coalesce(r ->> 'interior_color', ''), coalesce(r ->> 'url', ''),
        coalesce((select array_agg(i) from jsonb_array_elements_text(coalesce(r -> 'images', '[]'::jsonb)) i), '{}'),
        coalesce(r ->> 'description_html', ''), coalesce(r ->> 'dealer_name', ''),
        coalesce(r ->> 'dealer_address', ''), nullif(r ->> 'date_first_on_lot', '')::date
      ) returning * into v;
      insert into public.vehicle_events (vehicle_id, kind, new_price) values (v.id, 'added', v_price);
      v_added := v_added + 1;
      continue;
    end if;

    -- Blank price in the feed: keep what we had
    v_price := coalesce(v_price, v.price);

    if v.status = 'gone' then
      delete from public.vehicle_posts where vehicle_id = v.id;
      insert into public.vehicle_events (vehicle_id, kind, new_price) values (v.id, 'returned', v_price);
      v_returned := v_returned + 1;
    end if;

    if v.price is distinct from v_price then
      insert into public.vehicle_events (vehicle_id, kind, old_price, new_price)
        values (v.id, 'price_change', v.price, v_price);
      v_price_changes := v_price_changes + 1;

      select posted_by into v_poster from public.vehicle_posts where vehicle_id = v.id;
      if found then
        update public.inventory_alerts set new_price = v_price
          where vehicle_id = v.id and staff_id = v_poster and kind = 'price_change' and dismissed_at is null
          returning id, old_price into v_alert_id, v_alert_old;
        if not found then
          insert into public.inventory_alerts (vehicle_id, staff_id, kind, old_price, new_price)
            values (v.id, v_poster, 'price_change', v.price, v_price);
        elsif v_alert_old is not distinct from v_price then
          -- Back to the price the listing shows: nothing to update
          delete from public.inventory_alerts where id = v_alert_id;
        end if;
      end if;
    end if;

    update public.vehicles set
      stock_number = upper(r ->> 'stock_number'),
      year = nullif(r ->> 'year', '')::int,
      make = coalesce(r ->> 'make', ''),
      model = coalesce(r ->> 'model', ''),
      trim = coalesce(r ->> 'trim', ''),
      body_style = coalesce(r ->> 'body_style', ''),
      drivetrain = coalesce(r ->> 'drivetrain', ''),
      transmission = coalesce(r ->> 'transmission', ''),
      fuel_type = coalesce(r ->> 'fuel_type', ''),
      mileage = nullif(r ->> 'mileage', '')::int,
      price = v_price,
      exterior_color = coalesce(r ->> 'exterior_color', ''),
      interior_color = coalesce(r ->> 'interior_color', ''),
      url = coalesce(r ->> 'url', ''),
      images = coalesce((select array_agg(i) from jsonb_array_elements_text(coalesce(r -> 'images', '[]'::jsonb)) i), '{}'),
      description_html = coalesce(r ->> 'description_html', ''),
      dealer_name = coalesce(r ->> 'dealer_name', ''),
      dealer_address = coalesce(r ->> 'dealer_address', ''),
      date_first_on_lot = nullif(r ->> 'date_first_on_lot', '')::date,
      status = 'in_stock',
      removed_at = null,
      last_seen_at = now()
    where id = v.id;
    v_updated := v_updated + 1;
  end loop;

  -- Cars no longer in the feed. Their vehicle_posts row is kept until the poster dismisses the sold alert.
  for v in
    select * from public.vehicles
    where status = 'in_stock' and vin not in (select upper(x ->> 'vin') from jsonb_array_elements(p_rows) x)
  loop
    update public.vehicles set status = 'gone', removed_at = now() where id = v.id;
    insert into public.vehicle_events (vehicle_id, kind, old_price, days_on_lot)
      values (v.id, 'removed', v.price, case when v.date_first_on_lot is null then null else v_today - v.date_first_on_lot end);

    select posted_by into v_poster from public.vehicle_posts where vehicle_id = v.id;
    if found then
      update public.inventory_alerts set dismissed_at = now()
        where vehicle_id = v.id and kind = 'price_change' and dismissed_at is null;
      insert into public.inventory_alerts (vehicle_id, staff_id, kind, old_price)
        values (v.id, v_poster, 'sold', v.price);
    end if;
    v_removed := v_removed + 1;
  end loop;

  insert into public.inventory_runs (
    started_at, finished_at, status, trigger, triggered_by,
    added, updated, price_changes, removed, returned, rejected
  ) values (
    v_started, clock_timestamp(), 'ok', v_trigger, v_staff,
    v_added, v_updated, v_price_changes, v_removed, v_returned, coalesce(p_rejected, 0)
  );

  return jsonb_build_object('status', 'ok', 'added', v_added, 'updated', v_updated,
    'price_changes', v_price_changes, 'removed', v_removed, 'returned', v_returned, 'message', null);
end
$$;

-- Dismiss: the alert's owner or an admin. Dismissing a sold alert also clears the car's posted status
-- (the listing is down) — only while the car is still gone, so a car that returned and was re-posted keeps its post.

create or replace function public.dismiss_inventory_alert(p_alert_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := public.my_staff_id();
  a public.inventory_alerts;
begin
  if v_me is null then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  select * into a from public.inventory_alerts where id = p_alert_id for update;
  if not found then
    raise exception 'Alert not found';
  end if;
  if a.staff_id is distinct from v_me and not (select public.is_admin()) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  if a.dismissed_at is not null then
    return;
  end if;

  update public.inventory_alerts set dismissed_at = now() where id = a.id;

  if a.kind = 'sold' and exists (select 1 from public.vehicles where id = a.vehicle_id and status = 'gone') then
    delete from public.vehicle_posts where vehicle_id = a.vehicle_id;
    if found then
      insert into public.vehicle_events (vehicle_id, kind, by_staff) values (a.vehicle_id, 'unposted', v_me);
    end if;
  end if;
end
$$;

revoke execute on function public.dismiss_inventory_alert(uuid) from public, anon;
grant execute on function public.dismiss_inventory_alert(uuid) to authenticated;

-- delete_deal: identical to 0003 plus the save_deal role guard (porters can't delete deals).

create or replace function public.delete_deal(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := public.my_staff_id();
  v_old public.deals;
begin
  if v_me is null then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  if not public.is_admin() and not exists (select 1 from public.staff where id = v_me and is_salesperson) then
    raise exception 'Only salespeople and admins can delete deals' using errcode = '42501';
  end if;
  select * into v_old from public.deals where id = p_id;
  if not found then
    return;
  end if;
  if not public.is_admin()
     and (v_old.salesperson_id is distinct from v_me or v_old.sale_date < public.month_start()) then
    raise exception 'Only admins can delete this deal';
  end if;
  delete from public.deals where id = p_id;
end
$$;

-- Backfill: cars that left the feed while posted (before alerts existed) get their sold alert now.

insert into public.inventory_alerts (vehicle_id, staff_id, kind, old_price, created_at)
select v.id, p.posted_by, 'sold', v.price, coalesce(v.removed_at, now())
from public.vehicles v
join public.vehicle_posts p on p.vehicle_id = v.id
where v.status = 'gone'
  and not exists (
    select 1 from public.inventory_alerts a where a.vehicle_id = v.id and a.kind = 'sold' and a.dismissed_at is null
  );

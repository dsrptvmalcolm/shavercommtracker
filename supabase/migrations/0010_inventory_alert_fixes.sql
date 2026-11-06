-- Alert follow-ups from the phase 2 review.
--   * Marking a car not posted dismisses its open price alerts (the listing is down).
--   * At most one open alert per car, person and kind (a unique index backs the price-alert update in ingest).
--   * A car that leaves twice while posted by the same person keeps a single open sold alert.

-- Keep the newest open alert if duplicates ever slipped in, so the index can be built
update public.inventory_alerts a set dismissed_at = now()
where a.dismissed_at is null
  and exists (
    select 1 from public.inventory_alerts b
    where b.dismissed_at is null and b.vehicle_id = a.vehicle_id and b.staff_id = a.staff_id and b.kind = a.kind
      and (b.created_at, b.id) > (a.created_at, a.id)
  );

create unique index inventory_alerts_one_open_idx on public.inventory_alerts (vehicle_id, staff_id, kind)
  where dismissed_at is null;

-- set_vehicle_posted: identical to 0008 plus dismissing open price alerts on unpost.

create or replace function public.set_vehicle_posted(p_vehicle_id uuid, p_posted boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := public.my_staff_id();
  v_status text;
  v_is_posted boolean;
begin
  if v_me is null or not (select public.is_porter_or_admin()) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  select status into v_status from public.vehicles where id = p_vehicle_id for update;
  if not found then
    raise exception 'Vehicle not found';
  end if;
  v_is_posted := exists (select 1 from public.vehicle_posts where vehicle_id = p_vehicle_id);

  if p_posted then
    if v_status <> 'in_stock' then
      raise exception 'This car is no longer in inventory';
    end if;
    if v_is_posted then
      return;
    end if;
    insert into public.vehicle_posts (vehicle_id, posted_by) values (p_vehicle_id, v_me);
    insert into public.vehicle_events (vehicle_id, kind, by_staff) values (p_vehicle_id, 'posted', v_me);
  else
    if not v_is_posted then
      return;
    end if;
    delete from public.vehicle_posts where vehicle_id = p_vehicle_id;
    insert into public.vehicle_events (vehicle_id, kind, by_staff) values (p_vehicle_id, 'unposted', v_me);
    -- The listing is down, so there's nothing left to update
    update public.inventory_alerts set dismissed_at = now()
      where vehicle_id = p_vehicle_id and kind = 'price_change' and dismissed_at is null;
  end if;
end
$$;


-- ingest_inventory: identical to 0009 except the sold insert skips an existing open sold alert.

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
      -- Left, came back, was re-posted by the same person and left again: one open sold alert is enough
      insert into public.inventory_alerts (vehicle_id, staff_id, kind, old_price)
        values (v.id, v_poster, 'sold', v.price)
        on conflict (vehicle_id, staff_id, kind) where dismissed_at is null do nothing;
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


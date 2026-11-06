-- Inventory feed (VinCue), Porter staff type, Marketplace "posted" status.
-- Vehicles are never deleted: a car that leaves the feed becomes 'gone'. Writes only through the
-- security-definer functions below; tables expose SELECT policies only.

-- Porter staff type -----------------------------------------------------------

alter table public.staff add column is_porter boolean not null default false;

create or replace function public.is_porter_or_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select is_porter or is_admin from public.staff where email = (auth.jwt() ->> 'email')::citext and active),
    false
  )
$$;

revoke execute on function public.is_porter_or_admin() from public, anon;
grant execute on function public.is_porter_or_admin() to authenticated;

-- Feed settings (single row). Admin-only: the URL contains the dealer key. ---------

create table public.inventory_feed (
  id int primary key default 1 check (id = 1),
  url text,
  listing_phone text not null default '219-235-8687',
  updated_at timestamptz,
  updated_by uuid references public.staff (id)
);

insert into public.inventory_feed (id) values (1);

alter table public.inventory_feed enable row level security;
create policy inventory_feed_admin on public.inventory_feed for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- Porters need the phone for the Marketplace description without reading the feed row
create or replace function public.get_listing_phone()
returns text language plpgsql stable security definer set search_path = public as $$
begin
  if not (select public.is_porter_or_admin()) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  return (select listing_phone from public.inventory_feed where id = 1);
end
$$;

revoke execute on function public.get_listing_phone() from public, anon;
grant execute on function public.get_listing_phone() to authenticated;

-- Vehicles ------------------------------------------------------------------

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  vin text not null unique,
  stock_number text not null,
  year int,
  make text not null default '',
  model text not null default '',
  trim text not null default '',
  body_style text not null default '',
  drivetrain text not null default '',
  transmission text not null default '',
  fuel_type text not null default '',
  mileage int,
  price numeric(12, 2),
  first_price numeric(12, 2),
  exterior_color text not null default '',
  interior_color text not null default '',
  url text not null default '',
  images text[] not null default '{}',
  description_html text not null default '',
  dealer_name text not null default '',
  dealer_address text not null default '',
  date_first_on_lot date,
  status text not null default 'in_stock' check (status in ('in_stock', 'gone')),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  removed_at timestamptz
);

create index vehicles_stock_idx on public.vehicles (stock_number);
create index vehicles_status_lot_idx on public.vehicles (status, date_first_on_lot);

alter table public.vehicles enable row level security;
create policy vehicles_read on public.vehicles for select to authenticated
  using ((select public.my_staff_id()) is not null);

create table public.vehicle_events (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles (id),
  kind text not null check (kind in ('added', 'price_change', 'removed', 'returned', 'posted', 'unposted')),
  old_price numeric(12, 2),
  new_price numeric(12, 2),
  days_on_lot int,
  at timestamptz not null default now(),
  by_staff uuid references public.staff (id)
);

create index vehicle_events_vehicle_idx on public.vehicle_events (vehicle_id, at);

alter table public.vehicle_events enable row level security;
create policy vehicle_events_read on public.vehicle_events for select to authenticated using (
  (select public.my_staff_id()) is not null
  and (kind not in ('posted', 'unposted') or (select public.is_porter_or_admin()))
);

-- A row exists only while a car is posted. Porters and admins only.
create table public.vehicle_posts (
  vehicle_id uuid primary key references public.vehicles (id),
  posted_by uuid not null references public.staff (id),
  posted_at timestamptz not null default now()
);

alter table public.vehicle_posts enable row level security;
create policy vehicle_posts_read on public.vehicle_posts for select to authenticated
  using ((select public.is_porter_or_admin()));

create table public.inventory_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null check (status in ('ok', 'failed', 'stopped')),
  trigger text not null check (trigger in ('manual', 'schedule')),
  triggered_by uuid references public.staff (id),
  added int not null default 0,
  updated int not null default 0,
  price_changes int not null default 0,
  removed int not null default 0,
  returned int not null default 0,
  rejected int not null default 0,
  message text
);

create index inventory_runs_started_idx on public.inventory_runs (started_at desc);

alter table public.inventory_runs enable row level security;
create policy inventory_runs_admin on public.inventory_runs for select to authenticated
  using ((select public.is_admin()));

-- Ingest ----------------------------------------------------------------------
-- Called by admins (Refresh now) and by the daily cron through the service role.
-- p_rows: array of objects keyed like the vehicles columns (see src/lib/inventory/parse-feed.ts).
-- Safety stop: refuses to remove more than 30% of in-stock cars unless p_force.

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
begin
  if not ((select public.is_admin()) or coalesce(auth.jwt() ->> 'role', '') = 'service_role') then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
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

    if v.status = 'gone' then
      delete from public.vehicle_posts where vehicle_id = v.id;
      insert into public.vehicle_events (vehicle_id, kind, new_price) values (v.id, 'returned', v_price);
      v_returned := v_returned + 1;
    end if;

    if v.price is distinct from v_price then
      insert into public.vehicle_events (vehicle_id, kind, old_price, new_price)
        values (v.id, 'price_change', v.price, v_price);
      v_price_changes := v_price_changes + 1;
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

  -- Cars no longer in the feed. Their vehicle_posts row is kept (the poster still has to take the listing down).
  for v in
    select * from public.vehicles
    where status = 'in_stock' and vin not in (select upper(x ->> 'vin') from jsonb_array_elements(p_rows) x)
  loop
    update public.vehicles set status = 'gone', removed_at = now() where id = v.id;
    insert into public.vehicle_events (vehicle_id, kind, old_price, days_on_lot)
      values (v.id, 'removed', v.price, case when v.date_first_on_lot is null then null else v_today - v.date_first_on_lot end);
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

revoke execute on function public.ingest_inventory(jsonb, boolean, text, int) from public, anon;
grant execute on function public.ingest_inventory(jsonb, boolean, text, int) to authenticated, service_role;

-- Posted / not posted ---------------------------------------------------------

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
  end if;
end
$$;

revoke execute on function public.set_vehicle_posted(uuid, boolean) from public, anon;
grant execute on function public.set_vehicle_posted(uuid, boolean) to authenticated;

-- save_deal: identical to 0003 plus one guard — only active salespeople and admins log deals.

create or replace function public.save_deal(p jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := public.my_staff_id();
  v_admin boolean := public.is_admin();
  v_open date := public.month_start();
  v_old public.deals;
  v_id uuid := nullif(p ->> 'id', '')::uuid;
  v_sale_date date := (p ->> 'sale_date')::date;
  v_is_house boolean := coalesce((p ->> 'is_house')::boolean, false);
  v_sp uuid := nullif(p ->> 'salesperson_id', '')::uuid;
  v_split uuid := nullif(p ->> 'split_salesperson_id', '')::uuid;
  v_front numeric := nullif(p ->> 'front_gross', '')::numeric;
  v_back numeric := nullif(p ->> 'back_gross', '')::numeric;
  v_product_ids uuid[] := coalesce(
    (select array_agg(x::uuid) from jsonb_array_elements_text(coalesce(p -> 'product_ids', '[]'::jsonb)) x),
    '{}'
  );
begin
  if v_me is null then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  if not v_admin and not exists (select 1 from public.staff where id = v_me and is_salesperson) then
    raise exception 'Only salespeople and admins can log deals' using errcode = '42501';
  end if;

  if v_id is not null then
    select * into v_old from public.deals where id = v_id for update;
    if not found then
      raise exception 'Deal not found';
    end if;
  end if;

  if not v_admin then
    if v_sale_date is null or v_sale_date < v_open then
      raise exception 'This month is closed — ask an admin to make changes';
    end if;
    if v_id is not null then
      -- IS DISTINCT FROM so house deals (no salesperson) never match a salesperson
      if (v_old.salesperson_id is distinct from v_me and v_old.split_salesperson_id is distinct from v_me)
         or v_old.sale_date < v_open then
        raise exception 'You can only edit your own deals in the current month';
      end if;
      v_sp := v_old.salesperson_id;
      v_front := v_old.front_gross;
      v_back := v_old.back_gross;
    else
      v_sp := v_me;
      v_front := null;
      v_back := null;
    end if;
    v_is_house := false;
  end if;

  if v_is_house then
    v_sp := null;
    v_split := null;
  end if;

  if v_split = v_sp then
    v_split := null;
  end if;

  if v_id is null then
    insert into public.deals (
      sale_date, customer_name, stock_number, deal_number, deal_notes,
      salesperson_id, split_salesperson_id, is_house, front_gross, back_gross,
      multilingual, ninety_day, created_by
    ) values (
      v_sale_date, trim(p ->> 'customer_name'), upper(trim(p ->> 'stock_number')),
      nullif(trim(p ->> 'deal_number'), ''), nullif(trim(p ->> 'deal_notes'), ''),
      v_sp, v_split, v_is_house, v_front, v_back,
      coalesce((p ->> 'multilingual')::boolean, false),
      coalesce((p ->> 'ninety_day')::boolean, false),
      v_me
    ) returning id into v_id;
  else
    update public.deals set
      sale_date = v_sale_date,
      customer_name = trim(p ->> 'customer_name'),
      stock_number = upper(trim(p ->> 'stock_number')),
      deal_number = nullif(trim(p ->> 'deal_number'), ''),
      deal_notes = nullif(trim(p ->> 'deal_notes'), ''),
      salesperson_id = v_sp,
      split_salesperson_id = v_split,
      is_house = v_is_house,
      front_gross = v_front,
      back_gross = v_back,
      multilingual = coalesce((p ->> 'multilingual')::boolean, false),
      ninety_day = coalesce((p ->> 'ninety_day')::boolean, false),
      updated_at = now()
    where id = v_id;
  end if;

  delete from public.deal_products where deal_id = v_id and product_id <> all (v_product_ids);
  insert into public.deal_products (deal_id, product_id, spiff_amount)
    select v_id, pr.id, pr.spiff_amount from public.products pr where pr.id = any (v_product_ids)
    on conflict (deal_id, product_id) do nothing;

  return v_id;
end
$$;

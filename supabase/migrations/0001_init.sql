-- Shaver Commission Tracker — initial schema
-- Months are 'YYYY-MM' text in America/Chicago (Merrillville, IN).

create extension if not exists citext;

-- Staff -------------------------------------------------------------------

create table public.staff (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email citext unique,
  is_salesperson boolean not null default false,
  is_admin boolean not null default false,
  multilingual_eligible boolean not null default false,
  active boolean not null default true,
  -- Manual baseline; the app uses max(baseline, best month on record)
  personal_best_units numeric(6, 1) not null default 0,
  created_at timestamptz not null default now()
);

-- Settings: one row per month they took effect from ------------------------

create table public.commission_settings (
  effective_month text primary key check (effective_month ~ '^\d{4}-\d{2}$'),
  mini_tiers jsonb not null,            -- [{ "startUnits": 1, "amount": 200 }, ...]
  front_pct numeric(6, 4) not null default 0,
  back_pct numeric(6, 4) not null default 0,
  product_hat_trick_bonus numeric(10, 2) not null default 0,
  two_car_day_spiff numeric(10, 2) not null default 0,
  hat_trick_day_spiff numeric(10, 2) not null default 0,
  multilingual_spiff numeric(10, 2) not null default 0,
  ninety_day_spiff numeric(10, 2) not null default 0,
  personal_best_spiff numeric(10, 2) not null default 0,
  store_volume_tiers jsonb not null,    -- [{ "units": 75, "amount": 500 }, ...]
  updated_at timestamptz not null default now()
);

-- Products ------------------------------------------------------------------

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  spiff_amount numeric(10, 2) not null default 0,
  active boolean not null default true,
  sort_order int not null default 0
);

-- Deals -------------------------------------------------------------------

create table public.deals (
  id uuid primary key default gen_random_uuid(),
  sale_date date not null,
  customer_name text not null,
  stock_number text not null,
  deal_number text,
  deal_notes text,
  salesperson_id uuid references public.staff (id),
  split_salesperson_id uuid references public.staff (id),
  is_house boolean not null default false,
  front_gross numeric(12, 2),
  back_gross numeric(12, 2),
  multilingual boolean not null default false,
  ninety_day boolean not null default false,
  airtable_name text,
  created_by uuid references public.staff (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint deals_owner check (
    (is_house and salesperson_id is null and split_salesperson_id is null)
    or (not is_house and salesperson_id is not null)
  ),
  constraint deals_split_distinct check (split_salesperson_id is distinct from salesperson_id)
);

create index deals_sale_date_idx on public.deals (sale_date);
create index deals_salesperson_idx on public.deals (salesperson_id, sale_date);
create index deals_split_idx on public.deals (split_salesperson_id, sale_date);

-- Product lines carry the spiff amount at the time they were added
create table public.deal_products (
  deal_id uuid not null references public.deals (id) on delete cascade,
  product_id uuid not null references public.products (id),
  spiff_amount numeric(10, 2) not null,
  primary key (deal_id, product_id)
);

-- One-off and team spiffs -------------------------------------------------

create table public.adjustments (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff (id),
  month text not null check (month ~ '^\d{4}-\d{2}$'),
  amount numeric(10, 2) not null,
  note text not null,
  created_by uuid references public.staff (id),
  created_at timestamptz not null default now()
);

create index adjustments_month_idx on public.adjustments (month);

-- Months recorded as paid (Airtable history). These figures are shown as-is.

create table public.paid_months (
  staff_id uuid not null references public.staff (id),
  month text not null check (month ~ '^\d{4}-\d{2}$'),
  units numeric(6, 1) not null,
  mini_rate numeric(10, 2) not null,
  vehicle_commission numeric(12, 2) not null,
  product_spiffs numeric(12, 2) not null,
  multilingual_spiffs numeric(12, 2) not null default 0,
  ninety_day_spiffs numeric(12, 2) not null,
  two_car_day_count int not null,
  two_car_day_spiffs numeric(12, 2) not null,
  hat_trick_day_count int not null,
  hat_trick_day_spiffs numeric(12, 2) not null,
  personal_best_spiff numeric(12, 2) not null,
  store_volume_spiff numeric(12, 2) not null,
  adjustments numeric(12, 2) not null default 0,
  total numeric(12, 2) not null,
  source text not null default 'airtable',
  note text,
  primary key (staff_id, month)
);

-- Helpers -----------------------------------------------------------------

create or replace function public.month_start(ts timestamptz default now())
returns date language sql stable as $$
  select date_trunc('month', ts at time zone 'America/Chicago')::date
$$;

create or replace function public.my_staff_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.staff
  where email = (auth.jwt() ->> 'email')::citext and active
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select is_admin from public.staff where email = (auth.jwt() ->> 'email')::citext and active),
    false
  )
$$;

-- Store units for a month — salespeople need it for store pace/volume
-- without seeing other people's deals.
create or replace function public.store_units(p_month text)
returns int language sql stable security definer set search_path = public as $$
  select case when public.my_staff_id() is null then 0 else (
    select count(*)::int from public.deals
    where sale_date >= to_date(p_month || '-01', 'YYYY-MM-DD')
      and sale_date < (to_date(p_month || '-01', 'YYYY-MM-DD') + interval '1 month')
  ) end
$$;

-- Deal writes -------------------------------------------------------------
-- All deal writes go through these functions so the rules live in one place:
-- salespeople only touch their own deals in the open month and never gross;
-- admins can do anything.

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
      if v_me not in (v_old.salesperson_id, coalesce(v_old.split_salesperson_id, v_old.salesperson_id))
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

create or replace function public.delete_deal(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := public.my_staff_id();
  v_old public.deals;
begin
  if v_me is null then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  select * into v_old from public.deals where id = p_id;
  if not found then
    return;
  end if;
  if not public.is_admin() and (v_old.salesperson_id <> v_me or v_old.sale_date < public.month_start()) then
    raise exception 'Only admins can delete this deal';
  end if;
  delete from public.deals where id = p_id;
end
$$;

-- Admin-only gross entry, so finance can update gross without touching the rest
create or replace function public.set_deal_gross(p_id uuid, p_back numeric, p_front numeric)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  update public.deals set back_gross = p_back, front_gross = p_front, updated_at = now() where id = p_id;
end
$$;

revoke execute on function public.save_deal(jsonb), public.delete_deal(uuid),
  public.set_deal_gross(uuid, numeric, numeric), public.store_units(text) from public, anon;
grant execute on function public.save_deal(jsonb), public.delete_deal(uuid),
  public.set_deal_gross(uuid, numeric, numeric), public.store_units(text) to authenticated;

-- Row level security ------------------------------------------------------

alter table public.staff enable row level security;
alter table public.commission_settings enable row level security;
alter table public.products enable row level security;
alter table public.deals enable row level security;
alter table public.deal_products enable row level security;
alter table public.adjustments enable row level security;
alter table public.paid_months enable row level security;

-- Any signed-in staff member can read the team list, settings and products
create policy staff_read on public.staff for select to authenticated using (public.my_staff_id() is not null);
create policy settings_read on public.commission_settings for select to authenticated using (public.my_staff_id() is not null);
create policy products_read on public.products for select to authenticated using (public.my_staff_id() is not null);

create policy staff_admin on public.staff for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy settings_admin on public.commission_settings for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy products_admin on public.products for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Deals: admins see all, salespeople see deals they're on. Writes go through functions.
create policy deals_read on public.deals for select to authenticated using (
  public.is_admin() or public.my_staff_id() in (salesperson_id, split_salesperson_id)
);
create policy deal_products_read on public.deal_products for select to authenticated using (
  exists (select 1 from public.deals d where d.id = deal_id)
);

create policy adjustments_read on public.adjustments for select to authenticated using (
  public.is_admin() or staff_id = public.my_staff_id()
);
create policy adjustments_admin on public.adjustments for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy paid_months_read on public.paid_months for select to authenticated using (
  public.is_admin() or staff_id = public.my_staff_id()
);
create policy paid_months_admin on public.paid_months for all to authenticated using (public.is_admin()) with check (public.is_admin());

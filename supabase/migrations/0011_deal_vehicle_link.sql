-- 0011: link deals to vehicles (inventory phase 3).
-- The server decides the link from the stock number; the form never sends a vehicle id.

alter table public.deals add column vehicle_id uuid references public.vehicles (id);
create index deals_vehicle_idx on public.deals (vehicle_id);

-- The vehicle a deal links to: same stock number (case/space-insensitive), and the deal's sale date
-- on or after the car's lot date (reuse guard: an old deal never links to a newer car with a reused
-- number). Most recent qualifying car wins. A car with no lot date isn't blocked by the guard.
-- Internal helper: only save_deal (security definer) and this migration call it.
create or replace function public.vehicle_for_deal(p_stock text, p_sale_date date)
returns uuid language sql stable set search_path = public as $$
  select v.id from public.vehicles v
  where p_sale_date is not null
    and upper(trim(v.stock_number)) = upper(trim(p_stock))
    and (v.date_first_on_lot is null or p_sale_date >= v.date_first_on_lot)
  order by v.date_first_on_lot desc nulls last, v.first_seen_at desc
  limit 1
$$;

revoke execute on function public.vehicle_for_deal(text, date) from public, anon, authenticated;

-- save_deal: identical to 0008 (role guard included) plus vehicle_id, set from vehicle_for_deal on every save.

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
      multilingual, ninety_day, created_by, vehicle_id
    ) values (
      v_sale_date, trim(p ->> 'customer_name'), upper(trim(p ->> 'stock_number')),
      nullif(trim(p ->> 'deal_number'), ''), nullif(trim(p ->> 'deal_notes'), ''),
      v_sp, v_split, v_is_house, v_front, v_back,
      coalesce((p ->> 'multilingual')::boolean, false),
      coalesce((p ->> 'ninety_day')::boolean, false),
      v_me, public.vehicle_for_deal(p ->> 'stock_number', v_sale_date)
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
      vehicle_id = public.vehicle_for_deal(p ->> 'stock_number', v_sale_date),
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

-- One-time link of existing deals (only matters for cars in the feed since go-live).
update public.deals d set vehicle_id = l.vid
from (select id, public.vehicle_for_deal(stock_number, sale_date) vid from public.deals where vehicle_id is null) l
where d.id = l.id and l.vid is not null;

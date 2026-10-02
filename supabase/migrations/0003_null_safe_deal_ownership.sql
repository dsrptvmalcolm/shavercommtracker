-- Non-admins must never match a house deal (salesperson_id is null):
-- compare with IS DISTINCT FROM so NULLs count as "not yours".

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
  if not public.is_admin()
     and (v_old.salesperson_id is distinct from v_me or v_old.sale_date < public.month_start()) then
    raise exception 'Only admins can delete this deal';
  end if;
  delete from public.deals where id = p_id;
end
$$;

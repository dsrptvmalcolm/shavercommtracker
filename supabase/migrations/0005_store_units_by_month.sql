-- Store units per month (house deals included) for the store trend chart.
-- Store totals are already visible to every salesperson via store_units().
create or replace function public.store_units_by_month(p_from text, p_to text)
returns table (month text, units int)
language sql stable security definer set search_path = public as $$
  select to_char(sale_date, 'YYYY-MM'), count(*)::int
  from public.deals
  where public.my_staff_id() is not null
    and sale_date >= to_date(p_from || '-01', 'YYYY-MM-DD')
    and sale_date < (to_date(p_to || '-01', 'YYYY-MM-DD') + interval '1 month')
  group by 1
$$;

revoke execute on function public.store_units_by_month(text, text) from public, anon;
grant execute on function public.store_units_by_month(text, text) to authenticated;

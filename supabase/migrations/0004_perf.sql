-- Performance: evaluate auth helpers once per query instead of once per row
-- (wrapping in a scalar subquery makes Postgres cache the result as an InitPlan),
-- and roll units up by month in one query instead of one per salesperson.

drop policy staff_read on public.staff;
drop policy settings_read on public.commission_settings;
drop policy products_read on public.products;
drop policy staff_admin on public.staff;
drop policy settings_admin on public.commission_settings;
drop policy products_admin on public.products;
drop policy deals_read on public.deals;
drop policy deal_products_read on public.deal_products;
drop policy adjustments_read on public.adjustments;
drop policy adjustments_admin on public.adjustments;
drop policy paid_months_read on public.paid_months;
drop policy paid_months_admin on public.paid_months;

create policy staff_read on public.staff for select to authenticated using ((select public.my_staff_id()) is not null);
create policy settings_read on public.commission_settings for select to authenticated using ((select public.my_staff_id()) is not null);
create policy products_read on public.products for select to authenticated using ((select public.my_staff_id()) is not null);

create policy staff_admin on public.staff for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy settings_admin on public.commission_settings for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy products_admin on public.products for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create policy deals_read on public.deals for select to authenticated using (
  (select public.is_admin()) or (select public.my_staff_id()) in (salesperson_id, split_salesperson_id)
);
create policy deal_products_read on public.deal_products for select to authenticated using (
  exists (select 1 from public.deals d where d.id = deal_id)
);

create policy adjustments_read on public.adjustments for select to authenticated using (
  (select public.is_admin()) or staff_id = (select public.my_staff_id())
);
create policy adjustments_admin on public.adjustments for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create policy paid_months_read on public.paid_months for select to authenticated using (
  (select public.is_admin()) or staff_id = (select public.my_staff_id())
);
create policy paid_months_admin on public.paid_months for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- Units per salesperson per month from deals the caller can see (RLS applies).
-- Matches the engine: a split deal is half a unit each, house deals count for no one.
create or replace function public.units_by_month(p_staff uuid default null)
returns table (staff_id uuid, month text, units numeric)
language sql stable security invoker set search_path = public as $$
  select s.staff_id, to_char(d.sale_date, 'YYYY-MM'), sum(s.share)
  from public.deals d
  cross join lateral (values
    (d.salesperson_id, case when d.split_salesperson_id is null then 1.0 else 0.5 end),
    (d.split_salesperson_id, 0.5)
  ) as s (staff_id, share)
  where not d.is_house
    and s.staff_id is not null
    and (p_staff is null or s.staff_id = p_staff)
  group by 1, 2
$$;

revoke execute on function public.units_by_month(uuid) from public, anon;
grant execute on function public.units_by_month(uuid) to authenticated;

-- Dealership holidays: excluded from working days (Mon–Sat) for pacing
create table public.holidays (
  date date primary key,
  name text not null
);

alter table public.holidays enable row level security;
create policy holidays_read on public.holidays for select to authenticated using ((select public.my_staff_id()) is not null);
create policy holidays_admin on public.holidays for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

insert into public.holidays (date, name) values
  ('2026-01-01', 'New Year''s Day'),
  ('2026-05-25', 'Memorial Day'),
  ('2026-07-04', 'Independence Day'),
  ('2026-09-07', 'Labor Day'),
  ('2026-11-26', 'Thanksgiving'),
  ('2026-12-25', 'Christmas'),
  ('2027-01-01', 'New Year''s Day'),
  ('2027-05-31', 'Memorial Day'),
  ('2027-07-05', 'Independence Day (observed)'),
  ('2027-09-06', 'Labor Day'),
  ('2027-11-25', 'Thanksgiving'),
  ('2027-12-25', 'Christmas');

-- Set when an admin assigns a password; cleared when the person picks their own
alter table public.staff add column must_change_password boolean not null default false;

create or replace function public.clear_my_password_flag()
returns void language sql security definer set search_path = public as $$
  update public.staff set must_change_password = false where id = public.my_staff_id()
$$;

revoke execute on function public.clear_my_password_flag() from public, anon;
grant execute on function public.clear_my_password_flag() to authenticated;

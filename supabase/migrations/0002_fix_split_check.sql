-- House deals have no salesperson or split, and NULL IS DISTINCT FROM NULL is false
alter table public.deals drop constraint deals_split_distinct;
alter table public.deals add constraint deals_split_distinct
  check (split_salesperson_id is null or split_salesperson_id <> salesperson_id);

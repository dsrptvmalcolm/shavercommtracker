-- "Needs action" flag for the admin Deal Review screen.
-- What needs to happen is written into deal_notes so salespeople and admins see one history.

alter table public.deals add column needs_action boolean not null default false;

create index deals_needs_action_idx on public.deals (sale_date) where needs_action;

-- Admin-only. Flagging with a note appends "Needs action: <note>" to the deal notes;
-- clearing the flag (resolving) leaves the notes as they are.
create or replace function public.set_deal_needs_action(p_id uuid, p_flag boolean, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_note text := nullif(trim(coalesce(p_note, '')), '');
begin
  if not (select public.is_admin()) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  update public.deals set
    needs_action = p_flag,
    deal_notes = case
      when p_flag and v_note is not null then concat_ws(E'\n', nullif(deal_notes, ''), 'Needs action: ' || v_note)
      else deal_notes
    end,
    updated_at = now()
  where id = p_id;
end
$$;

revoke execute on function public.set_deal_needs_action(uuid, boolean, text) from public, anon;
grant execute on function public.set_deal_needs_action(uuid, boolean, text) to authenticated;

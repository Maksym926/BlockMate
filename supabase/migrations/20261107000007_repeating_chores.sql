-- T8: Repeating chores (D-007)
-- create_next_occurrence is called by the client after completing a repeating chore.
-- The client then calls suggest-assignee + assign_occurrence for person-scope chores.

create function public.create_next_occurrence(
  p_chore_id uuid,
  p_due_at   timestamptz
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_chore      public.chores;
  v_new_occ_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select * into v_chore from public.chores where id = p_chore_id;
  if v_chore.id is null then
    raise exception 'chore not found';
  end if;

  if not is_room_member(v_chore.room_id) then
    raise exception 'not authenticated';
  end if;

  if v_chore.repeat_interval is null then
    raise exception 'chore not repeating';
  end if;

  insert into public.occurrences (chore_id, room_id, due_at)
    values (v_chore.id, v_chore.room_id, p_due_at)
    returning id into v_new_occ_id;

  return v_new_occ_id;
end;
$$;

grant execute on function public.create_next_occurrence(uuid, timestamptz) to authenticated;

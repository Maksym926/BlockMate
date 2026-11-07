-- T6: AI suggestion – add suggestion_reason / suggestion_source to create_chore.
-- Drop and recreate with two new optional params (suggestion_reason, suggestion_source).

drop function public.create_chore(uuid, text, text, integer, text, uuid, timestamptz);

create function public.create_chore(
  p_room_id              uuid,
  p_title                text,
  p_repeat_interval      text,       -- null | 'daily' | 'weekly' | 'custom'
  p_repeat_days          integer,    -- null unless 'custom'
  p_scope                text,       -- 'person' | 'room'
  p_assignee_id          uuid,       -- null for room-scope
  p_due_at               timestamptz, -- client-computed local 18:00 (D-021)
  p_suggestion_reason    text    default null,
  p_suggestion_source    text    default 'manual' -- 'ai' | 'fallback' | 'manual'
) returns public.chores
language plpgsql security definer set search_path = public as $$
declare
  creator            public.residents;
  member_count       integer;
  new_chore          public.chores;
  effective_assignee uuid;
  effective_source   text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select * into creator from public.residents
    where room_id = p_room_id and user_id = auth.uid();
  if creator.id is null then
    raise exception 'not a member' using errcode = '42501';
  end if;

  select count(*) into member_count from public.residents where room_id = p_room_id;
  if member_count < 2 then
    raise exception 'room needs 2 members' using errcode = '23514';
  end if;

  if p_title is null or length(btrim(p_title)) = 0 then
    raise exception 'chore title required' using errcode = '22023';
  end if;

  if p_scope = 'person' then
    if p_assignee_id is null then
      raise exception 'assignee required' using errcode = '22023';
    end if;
    if not exists (
      select 1 from public.residents where id = p_assignee_id and room_id = p_room_id
    ) then
      raise exception 'assignee not in room' using errcode = '22023';
    end if;
    effective_assignee := p_assignee_id;
  else
    effective_assignee := null;
  end if;

  -- Normalise source; default to 'manual' for room-scope (no AI involved)
  effective_source := coalesce(
    case when p_scope = 'room' then 'manual' else p_suggestion_source end,
    'manual'
  );

  insert into public.chores (room_id, title, repeat_interval, repeat_days, scope, created_by)
    values (p_room_id, btrim(p_title), p_repeat_interval, p_repeat_days, p_scope, creator.id)
    returning * into new_chore;

  insert into public.occurrences
    (chore_id, room_id, assignee_id, due_at, suggestion_reason, suggestion_source)
    values (
      new_chore.id, p_room_id, effective_assignee, p_due_at,
      case when effective_source = 'manual' then null else p_suggestion_reason end,
      effective_source
    );

  return new_chore;
end $$;

revoke all on function public.create_chore(uuid, text, text, integer, text, uuid, timestamptz, text, text) from public, anon;
grant execute on function public.create_chore(uuid, text, text, integer, text, uuid, timestamptz, text, text) to authenticated;

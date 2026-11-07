-- T7: Pass a chore (D-011)
-- pass_occurrence: records the pass, clears the assignee.
-- assign_occurrence: sets the new assignee + suggestion info (called by client after getting AI suggestion).

-- ── pass_occurrence ───────────────────────────────────────────────────────────
-- Adds the caller's resident to passed_by, clears assignee_id.
-- Returns { all_passed, passed_by, old_assignee_id }.
create function public.pass_occurrence(p_occurrence_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_occurrence   occurrences%rowtype;
  v_resident     residents%rowtype;
  v_member_count integer;
  v_new_passed   uuid[];
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select * into v_occurrence from occurrences where id = p_occurrence_id for update;
  if not found then
    raise exception 'occurrence not found';
  end if;

  if not is_room_member(v_occurrence.room_id) then
    raise exception 'not authenticated';
  end if;

  if v_occurrence.status = 'done' then
    raise exception 'already done';
  end if;

  select * into v_resident
    from residents where room_id = v_occurrence.room_id and user_id = auth.uid();
  if v_resident.id is null then
    raise exception 'not authenticated';
  end if;

  if v_resident.id = any(v_occurrence.passed_by) then
    raise exception 'already passed';
  end if;

  -- Record pass and clear assignee
  update occurrences
    set passed_by        = array_append(passed_by, v_resident.id),
        assignee_id      = null,
        suggestion_reason = null,
        suggestion_source = null
    where id = p_occurrence_id
    returning passed_by into v_new_passed;

  select count(*) into v_member_count from residents where room_id = v_occurrence.room_id;

  return json_build_object(
    'all_passed',      array_length(v_new_passed, 1) >= v_member_count,
    'passed_by',       v_new_passed,
    'old_assignee_id', v_occurrence.assignee_id
  );
end;
$$;

grant execute on function public.pass_occurrence(uuid) to authenticated;

-- ── assign_occurrence ─────────────────────────────────────────────────────────
-- Sets assignee_id + suggestion fields. Called after getting a new AI suggestion
-- following a pass. Also used for the "all passed -> open to room" case (p_assignee_id = null).
create function public.assign_occurrence(
  p_occurrence_id      uuid,
  p_assignee_id        uuid    default null,
  p_suggestion_reason  text    default null,
  p_suggestion_source  text    default 'manual'
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_occurrence occurrences%rowtype;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select * into v_occurrence from occurrences where id = p_occurrence_id;
  if not found then
    raise exception 'occurrence not found';
  end if;

  if not is_room_member(v_occurrence.room_id) then
    raise exception 'not authenticated';
  end if;

  if v_occurrence.status = 'done' then
    raise exception 'already done';
  end if;

  update occurrences
    set assignee_id       = p_assignee_id,
        suggestion_reason = p_suggestion_reason,
        suggestion_source = p_suggestion_source
    where id = p_occurrence_id;
end;
$$;

grant execute on function public.assign_occurrence(uuid, uuid, text, text) to authenticated;

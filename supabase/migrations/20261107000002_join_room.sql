-- T1 (UC-01): join a room by code. Non-members cannot read rooms, so lookup and join are RPCs.

-- Codes are case-insensitive on entry (D-023); tolerate spaces and dashes typed by users.
create function public.normalize_join_code(p_code text) returns text
language sql immutable as $$
  select upper(regexp_replace(coalesce(p_code, ''), '[\s-]', '', 'g'));
$$;

-- Pre-join peek for the "Found Flat 12B / Maya is already in" screen. Reveals only the
-- room name and member display names, and only to someone who holds the code.
create function public.preview_room(p_code text)
returns table (room_name text, resident_names text[])
language plpgsql stable security definer set search_path = public as $$
declare
  target public.rooms;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  select * into target from public.rooms where join_code = public.normalize_join_code(p_code);
  if target.id is null then
    raise exception 'room not found' using errcode = 'PT404';
  end if;
  return query
    select target.name,
           coalesce(array_agg(r.display_name order by r.joined_at), '{}'::text[])
    from public.residents r where r.room_id = target.id;
end $$;

-- PT404 is PostgREST's custom code for HTTP 404: an unknown code is a client error, not a 500.
-- Join (or re-open) a room. Already a member -> return the room, no duplicate (UC-01 4c).
create function public.join_room(p_code text, p_display_name text)
returns public.rooms
language plpgsql security definer set search_path = public as $$
declare
  target public.rooms;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  select * into target from public.rooms where join_code = public.normalize_join_code(p_code);
  if target.id is null then
    raise exception 'room not found' using errcode = 'PT404';
  end if;
  if exists (select 1 from public.residents where room_id = target.id and user_id = auth.uid()) then
    return target;
  end if;
  if p_display_name is null or length(btrim(p_display_name)) = 0 then
    raise exception 'display name required' using errcode = '22023';
  end if;
  begin
    -- A concurrent retry (double tap) for the same user is a no-op, not a name clash (UC-01 4c).
    insert into public.residents (room_id, user_id, display_name)
      values (target.id, auth.uid(), btrim(p_display_name))
      on conflict (room_id, user_id) do nothing;
  exception when unique_violation then
    -- Only the (room_id, lower(display_name)) index can still fire here (D-013).
    raise exception 'display name taken' using errcode = '23505';
  end;
  return target;
end $$;

-- Internal helper: only called from the SECURITY DEFINER functions above, not an API.
revoke all on function public.normalize_join_code(text) from public, anon, authenticated;

revoke all on function public.preview_room(text) from public, anon;
revoke all on function public.join_room(text, text) from public, anon;
grant execute on function public.preview_room(text) to authenticated;
grant execute on function public.join_room(text, text) to authenticated;

-- T5: Complete a chore
-- completions table records who completed an occurrence and when.

create table public.completions (
  id            uuid primary key default gen_random_uuid(),
  occurrence_id uuid not null references public.occurrences(id) on delete cascade,
  room_id       uuid not null references public.rooms(id) on delete cascade,
  resident_id   uuid not null references public.residents(id) on delete cascade,
  completed_at  timestamptz not null default now()
);

alter table public.completions enable row level security;

create policy "room members can read completions"
  on public.completions for select
  using (is_room_member(room_id));

create policy "room members can insert completions"
  on public.completions for insert
  with check (is_room_member(room_id) and resident_id = auth.uid());

-- Publish completions changes so clients get live updates.
alter publication supabase_realtime add table public.completions;

-- ── RPC: complete_occurrence ──────────────────────────────────────────────────
-- Sets occurrence.status = 'done', inserts a completion row, returns
-- { resident_id, display_name, completed_at } for the confirmation screen.
create or replace function public.complete_occurrence(p_occurrence_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_occurrence  occurrences%rowtype;
  v_resident    residents%rowtype;
  v_completed_at timestamptz;
begin
  -- Authenticate
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  -- Lock and load the occurrence
  select * into v_occurrence
  from occurrences
  where id = p_occurrence_id
  for update;

  if not found then
    raise exception 'occurrence not found';
  end if;

  -- Authorise: caller must be in the same room
  if not is_room_member(v_occurrence.room_id) then
    raise exception 'not authenticated';
  end if;

  if v_occurrence.status = 'done' then
    raise exception 'already done';
  end if;

  -- Mark done
  update occurrences
  set status = 'done'
  where id = p_occurrence_id;

  -- Log the completion
  v_completed_at := now();

  insert into completions (occurrence_id, room_id, resident_id, completed_at)
  values (p_occurrence_id, v_occurrence.room_id, auth.uid(), v_completed_at);

  -- Return info for the confirmation screen
  select * into v_resident from residents where id = auth.uid();

  return json_build_object(
    'resident_id',   auth.uid(),
    'display_name',  v_resident.display_name,
    'completed_at',  v_completed_at
  );
end;
$$;

grant execute on function public.complete_occurrence(uuid) to authenticated;

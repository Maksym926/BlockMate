-- T4: chores and occurrences (UC-02). Writes go through RPCs; direct DML via RLS only where noted.

create table public.chores (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  title text not null check (length(btrim(title)) > 0),
  -- null = one-off; 'daily' | 'weekly' | 'custom' = repeating (D-021)
  repeat_interval text check (repeat_interval in ('daily', 'weekly', 'custom')),
  -- only set when repeat_interval = 'custom'; 1–30 days (D-021)
  repeat_days integer check (repeat_days is null or (repeat_days >= 1 and repeat_days <= 30)),
  scope text not null default 'person' check (scope in ('person', 'room')),
  created_by uuid not null references public.residents(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.occurrences (
  id uuid primary key default gen_random_uuid(),
  chore_id uuid not null references public.chores(id) on delete cascade,
  room_id uuid not null references public.rooms(id) on delete cascade,
  assignee_id uuid references public.residents(id) on delete set null,
  due_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'done', 'passed')),
  suggestion_reason text,
  suggestion_source text check (suggestion_source in ('ai', 'fallback', 'manual')),
  passed_by uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

alter table public.chores enable row level security;
alter table public.occurrences enable row level security;

-- D-017: any member may read, create, update or delete any chore in their room.
create policy chores_member on public.chores for all to authenticated
  using (public.is_room_member(room_id))
  with check (public.is_room_member(room_id));

create policy occurrences_member on public.occurrences for all to authenticated
  using (public.is_room_member(room_id))
  with check (public.is_room_member(room_id));

-- Live updates for the chore list (UC-02 story 28).
alter publication supabase_realtime add table public.chores;
alter publication supabase_realtime add table public.occurrences;

-- Create a chore and its first occurrence.
-- Due time is passed by the client in UTC (D-021: default 18:00 local, computed client-side).
-- p_scope='person' requires p_assignee_id; 'room' ignores it (D-009).
create function public.create_chore(
  p_room_id         uuid,
  p_title           text,
  p_repeat_interval text,       -- null | 'daily' | 'weekly' | 'custom'
  p_repeat_days     integer,    -- null unless 'custom'
  p_scope           text,       -- 'person' | 'room'
  p_assignee_id     uuid,       -- null for room-scope
  p_due_at          timestamptz -- client-computed local 18:00 (D-021)
) returns public.chores
language plpgsql security definer set search_path = public as $$
declare
  creator      public.residents;
  member_count integer;
  new_chore    public.chores;
  effective_assignee uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select * into creator from public.residents
    where room_id = p_room_id and user_id = auth.uid();
  if creator.id is null then
    raise exception 'not a member' using errcode = '42501';
  end if;

  -- UC-02 pre-condition: 2+ members (spec invariant).
  select count(*) into member_count from public.residents where room_id = p_room_id;
  if member_count < 2 then
    raise exception 'room needs 2 members' using errcode = '23514';
  end if;

  if p_title is null or length(btrim(p_title)) = 0 then
    raise exception 'chore title required' using errcode = '22023';
  end if;

  -- Validate assignee for person-scope (D-009).
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
    effective_assignee := null; -- room-scope: anyone can complete (D-009)
  end if;

  insert into public.chores (room_id, title, repeat_interval, repeat_days, scope, created_by)
    values (p_room_id, btrim(p_title), p_repeat_interval, p_repeat_days, p_scope, creator.id)
    returning * into new_chore;

  insert into public.occurrences (chore_id, room_id, assignee_id, due_at, suggestion_source)
    values (new_chore.id, p_room_id, effective_assignee, p_due_at, 'manual');

  return new_chore;
end $$;

revoke all on function public.create_chore(uuid, text, text, integer, text, uuid, timestamptz) from public, anon;
grant execute on function public.create_chore(uuid, text, text, integer, text, uuid, timestamptz) to authenticated;

-- Delete a chore and all its occurrences (cascade). D-017: any member may delete.
create function public.delete_chore(p_chore_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  target public.chores;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  select * into target from public.chores where id = p_chore_id;
  if target.id is null then
    raise exception 'chore not found' using errcode = 'PT404';
  end if;
  if not public.is_room_member(target.room_id) then
    raise exception 'not a member' using errcode = '42501';
  end if;
  delete from public.chores where id = p_chore_id;
end $$;

revoke all on function public.delete_chore(uuid) from public, anon;
grant execute on function public.delete_chore(uuid) to authenticated;

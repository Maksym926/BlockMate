-- T1: rooms and residents (UC-01). Writes go through RPCs; clients get read-only table access.

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) > 0),
  join_code text not null unique,
  created_at timestamptz not null default now()
);

create table public.residents (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null check (length(btrim(display_name)) > 0),
  joined_at timestamptz not null default now(),
  unique (room_id, user_id)
);
-- Display names are unique per room, case-insensitive (D-013).
create unique index residents_room_name_unique on public.residents (room_id, lower(btrim(display_name)));
create index residents_user_idx on public.residents (user_id);

alter table public.rooms enable row level security;
alter table public.residents enable row level security;

-- Membership check as SECURITY DEFINER so policies on residents do not recurse into themselves.
create function public.is_room_member(p_room_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.residents r where r.room_id = p_room_id and r.user_id = auth.uid());
$$;

-- Used by RLS policies, which run as the caller: authenticated only, never anon.
revoke all on function public.is_room_member(uuid) from public, anon;
grant execute on function public.is_room_member(uuid) to authenticated;

create policy rooms_select_member on public.rooms for select to authenticated
  using (public.is_room_member(id));
create policy residents_select_member on public.residents for select to authenticated
  using (public.is_room_member(room_id));

-- Join code: 6 chars, unambiguous alphabet (D-023).
create function public.generate_join_code() returns text
language plpgsql volatile as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text;
begin
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.rooms where join_code = code);
  end loop;
  return code;
end $$;

-- Internal helper: only called from create_room (SECURITY DEFINER), not an API.
revoke all on function public.generate_join_code() from public, anon, authenticated;

create function public.create_room(p_room_name text, p_display_name text)
returns public.rooms
language plpgsql security definer set search_path = public as $$
declare
  new_room public.rooms;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_display_name is null or length(btrim(p_display_name)) = 0 then
    raise exception 'display name required' using errcode = '22023';
  end if;
  if p_room_name is null or length(btrim(p_room_name)) = 0 then
    raise exception 'room name required' using errcode = '22023';
  end if;
  insert into public.rooms (name, join_code)
    values (btrim(p_room_name), public.generate_join_code())
    returning * into new_room;
  insert into public.residents (room_id, user_id, display_name)
    values (new_room.id, auth.uid(), btrim(p_display_name));
  return new_room;
end $$;

revoke all on function public.create_room(text, text) from public, anon;
grant execute on function public.create_room(text, text) to authenticated;

-- Live member list.
alter publication supabase_realtime add table public.residents;

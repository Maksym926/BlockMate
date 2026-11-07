-- T11: Shopping list core (UC-03).

create table public.shopping_items (
  id          uuid primary key default gen_random_uuid(),
  room_id     uuid not null references public.rooms(id) on delete cascade,
  name        text not null check (char_length(btrim(name)) > 0 and char_length(name) <= 100),
  quantity    integer not null default 1 check (quantity > 0),
  added_by    uuid not null references public.residents(id) on delete cascade,
  status      text not null default 'active' check (status in ('active', 'bought')),
  bought_by   uuid references public.residents(id) on delete set null,
  bought_at   timestamptz,
  created_at  timestamptz not null default now()
);

alter table public.shopping_items enable row level security;

-- Any room member may read, write or delete any item (D-017 extended to shopping).
create policy shopping_items_member on public.shopping_items for all to authenticated
  using  (public.is_room_member(room_id))
  with check (public.is_room_member(room_id));

-- Live updates on this table.
alter publication supabase_realtime add table public.shopping_items;

-- ── RPC: add_shopping_item ────────────────────────────────────────────────────
-- Records the caller's resident ID as `added_by`.
create or replace function public.add_shopping_item(
  p_room_id  uuid,
  p_name     text,
  p_quantity integer default 1
) returns public.shopping_items
language plpgsql security definer set search_path = public
as $$
declare
  v_resident_id uuid;
  v_item        public.shopping_items;
begin
  select id into v_resident_id
  from public.residents
  where room_id = p_room_id and user_id = auth.uid();

  if v_resident_id is null then
    raise exception 'not a member of this room';
  end if;

  insert into public.shopping_items (room_id, name, quantity, added_by)
  values (p_room_id, btrim(p_name), p_quantity, v_resident_id)
  returning * into v_item;

  return v_item;
end;
$$;

-- ── RPC: tick_shopping_item ───────────────────────────────────────────────────
-- Marks an active item as bought; records the caller as buyer.
create or replace function public.tick_shopping_item(
  p_item_id uuid
) returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_room_id     uuid;
  v_resident_id uuid;
begin
  select room_id into v_room_id from public.shopping_items where id = p_item_id;
  if not found then raise exception 'item not found'; end if;

  select id into v_resident_id
  from public.residents
  where room_id = v_room_id and user_id = auth.uid();

  if v_resident_id is null then raise exception 'not a member of this room'; end if;

  update public.shopping_items
  set status = 'bought', bought_by = v_resident_id, bought_at = now()
  where id = p_item_id and status = 'active';
end;
$$;

-- ── RPC: untick_shopping_item ─────────────────────────────────────────────────
create or replace function public.untick_shopping_item(
  p_item_id uuid
) returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_room_id uuid;
begin
  select room_id into v_room_id from public.shopping_items where id = p_item_id;
  if not found then raise exception 'item not found'; end if;
  if not public.is_room_member(v_room_id) then raise exception 'not a member of this room'; end if;

  update public.shopping_items
  set status = 'active', bought_by = null, bought_at = null
  where id = p_item_id and status = 'bought';
end;
$$;

-- ── RPC: delete_shopping_item ─────────────────────────────────────────────────
create or replace function public.delete_shopping_item(
  p_item_id uuid
) returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_room_id uuid;
begin
  select room_id into v_room_id from public.shopping_items where id = p_item_id;
  if not found then raise exception 'item not found'; end if;
  if not public.is_room_member(v_room_id) then raise exception 'not a member of this room'; end if;

  delete from public.shopping_items where id = p_item_id;
end;
$$;

-- ── RPC: increase_item_quantity ───────────────────────────────────────────────
-- Adds p_add_quantity to the existing quantity (duplicate-name shortcut).
create or replace function public.increase_item_quantity(
  p_item_id    uuid,
  p_add_quantity integer
) returns public.shopping_items
language plpgsql security definer set search_path = public
as $$
declare
  v_room_id uuid;
  v_item    public.shopping_items;
begin
  select room_id into v_room_id from public.shopping_items where id = p_item_id;
  if not found then raise exception 'item not found'; end if;
  if not public.is_room_member(v_room_id) then raise exception 'not a member of this room'; end if;

  update public.shopping_items
  set quantity = quantity + p_add_quantity
  where id = p_item_id
  returning * into v_item;

  return v_item;
end;
$$;

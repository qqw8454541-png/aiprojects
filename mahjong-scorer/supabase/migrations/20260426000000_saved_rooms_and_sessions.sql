-- ─────────────────────────────────────────────────────────────────────────
-- saved_members: 跨房间可共用的成员模板
-- ─────────────────────────────────────────────────────────────────────────
create table public.saved_members (
  id          uuid primary key default gen_random_uuid(),
  device_id   text not null,
  name        text not null,
  avatar_seed text not null default '',
  created_at  timestamptz not null default now()
);

alter table public.saved_members enable row level security;
create policy "saved_members: device owner full access"
  on public.saved_members
  using (device_id = current_setting('request.headers', true)::json->>'x-device-id')
  with check (device_id = current_setting('request.headers', true)::json->>'x-device-id');

-- Fallback: allow all public access (for anonymous device-id pattern without custom headers)
create policy "saved_members: public select"  on public.saved_members for select  using (true);
create policy "saved_members: public insert"  on public.saved_members for insert  with check (true);
create policy "saved_members: public update"  on public.saved_members for update  using (true);
create policy "saved_members: public delete"  on public.saved_members for delete  using (true);


-- ─────────────────────────────────────────────────────────────────────────
-- saved_rooms: 已保存的房间模板
-- ─────────────────────────────────────────────────────────────────────────
create table public.saved_rooms (
  id          uuid primary key default gen_random_uuid(),
  device_id   text not null,
  name        text not null,
  rules       jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.saved_rooms enable row level security;
create policy "saved_rooms: public select"  on public.saved_rooms for select  using (true);
create policy "saved_rooms: public insert"  on public.saved_rooms for insert  with check (true);
create policy "saved_rooms: public update"  on public.saved_rooms for update  using (true);
create policy "saved_rooms: public delete"  on public.saved_rooms for delete  using (true);

-- Auto-update updated_at
create trigger saved_rooms_updated_at
  before update on public.saved_rooms
  for each row execute procedure public.handle_updated_at();


-- ─────────────────────────────────────────────────────────────────────────
-- room_members: 房间 <-> 成员 N:N 关联
-- ─────────────────────────────────────────────────────────────────────────
create table public.room_members (
  room_id   uuid not null references public.saved_rooms(id) on delete cascade,
  member_id uuid not null references public.saved_members(id) on delete cascade,
  sort_order int not null default 0,
  primary key (room_id, member_id)
);

alter table public.room_members enable row level security;
create policy "room_members: public select"  on public.room_members for select  using (true);
create policy "room_members: public insert"  on public.room_members for insert  with check (true);
create policy "room_members: public update"  on public.room_members for update  using (true);
create policy "room_members: public delete"  on public.room_members for delete  using (true);


-- ─────────────────────────────────────────────────────────────────────────
-- completed_sessions: 已完成对局归档（快照，不依赖 rooms 表）
-- ─────────────────────────────────────────────────────────────────────────
create table public.completed_sessions (
  id             uuid primary key default gen_random_uuid(),
  device_id      text not null,
  saved_room_id  uuid references public.saved_rooms(id) on delete set null,
  room_name      text not null default '',
  rounds         jsonb not null default '[]'::jsonb,  -- RoundResult[] snapshot
  players        jsonb not null default '[]'::jsonb,  -- Player[] snapshot
  played_at      timestamptz not null default now()
);

alter table public.completed_sessions enable row level security;
create policy "sessions: public select"  on public.completed_sessions for select  using (true);
create policy "sessions: public insert"  on public.completed_sessions for insert  with check (true);
create policy "sessions: public update"  on public.completed_sessions for update  using (true);
create policy "sessions: public delete"  on public.completed_sessions for delete  using (true);

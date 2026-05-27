-- Add user_id column to tables
alter table public.saved_members add column user_id uuid references auth.users(id) on delete cascade;
alter table public.saved_rooms add column user_id uuid references auth.users(id) on delete cascade;
alter table public.completed_sessions add column user_id uuid references auth.users(id) on delete cascade;

-- Update RLS policies to allow authenticated users to manage their data
-- saved_members
create policy "saved_members: auth user full access"
  on public.saved_members
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- saved_rooms
create policy "saved_rooms: auth user full access"
  on public.saved_rooms
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- completed_sessions
create policy "sessions: auth user full access"
  on public.completed_sessions
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

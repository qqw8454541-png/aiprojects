create table public.rooms (
  room_code text primary key,
  state jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Turn on row level security, but allow all operations without auth.
alter table public.rooms enable row level security;
create policy "Allow public read" on public.rooms for select using (true);
create policy "Allow public insert" on public.rooms for insert with check (true);
create policy "Allow public update" on public.rooms for update using (true);

-- Function to automatically update the 'updated_at' column
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

create trigger handle_updated_at
before update on public.rooms
for each row
execute procedure public.handle_updated_at();

-- Enable realtime
alter publication supabase_realtime add table public.rooms;

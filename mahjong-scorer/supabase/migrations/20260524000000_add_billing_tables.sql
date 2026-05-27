-- ─────────────────────────────────────────────────────────────────────────
-- profiles: 用户档案（VIP 状态 + AI 额度）
-- 
-- 当前阶段使用 device_id 关联匿名用户。
-- 接入真实 Auth 后，id 将映射到 auth.uid()。
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id            uuid primary key default gen_random_uuid(),
  device_id     text,
  display_name  text not null default '',
  avatar_url    text,
  tier          text not null default 'free',
  pro_since     timestamptz,
  ai_credits    integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Index for device_id lookups (primary lookup method in mock auth phase)
create index if not exists idx_profiles_device_id on public.profiles(device_id);

alter table public.profiles enable row level security;

-- 当前阶段：公开访问（Mock Auth 无法提供 auth.uid()）
-- TODO: 接入真实 Auth 后替换为 auth.uid() = id 策略
create policy "profiles: public select"  on public.profiles for select  using (true);
create policy "profiles: public insert"  on public.profiles for insert  with check (true);
create policy "profiles: public update"  on public.profiles for update  using (true);

-- Auto-update updated_at
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.handle_updated_at();


-- ─────────────────────────────────────────────────────────────────────────
-- ai_usage_log: AI 调用审计日志
--
-- 记录每次 AI 战报生成的调用记录，用于成本追踪和分析。
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.ai_usage_log (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  used_at     timestamptz not null default now(),
  token_count integer default 0,
  model       text default ''
);

alter table public.ai_usage_log enable row level security;

-- 当前阶段：公开访问
create policy "ai_usage_log: public select"  on public.ai_usage_log for select  using (true);
create policy "ai_usage_log: public insert"  on public.ai_usage_log for insert  with check (true);

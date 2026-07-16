-- ─────────────────────────────────────────────────────────────────────────
-- 订阅相关字段扩展
--
-- 为 profiles 表添加应用内购买 (IAP) 相关字段，
-- 记录订阅来源、商品 ID、过期时间，便于服务端验证和权限同步。
-- ─────────────────────────────────────────────────────────────────────────

-- 订阅平台 (android / ios)
alter table public.profiles
  add column if not exists subscription_platform text;

-- 商品 ID (对应 Google Play / App Store 中的 product ID)
alter table public.profiles
  add column if not exists subscription_product_id text;

-- 订阅过期时间（用于服务端判断权限是否仍然有效）
alter table public.profiles
  add column if not exists subscription_expires_at timestamptz;

-- 商店购买令牌（用于服务端调用 Google Play Developer API / App Store Server API 验证）
-- TODO(security): 此字段包含敏感购买凭证，正式环境应通过 RLS 限制仅 service_role 可读写
alter table public.profiles
  add column if not exists subscription_purchase_token text;

-- 索引：按过期时间查找即将过期或已过期的订阅
create index if not exists idx_profiles_subscription_expires
  on public.profiles(subscription_expires_at)
  where subscription_expires_at is not null;

comment on column public.profiles.subscription_platform is 'IAP 订阅来源平台: android | ios';
comment on column public.profiles.subscription_product_id is '商店商品 ID，如 pro_monthly';
comment on column public.profiles.subscription_expires_at is '订阅过期时间，用于服务端权限校验';
comment on column public.profiles.subscription_purchase_token is '商店购买令牌，用于服务端收据验证';

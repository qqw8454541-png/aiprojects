-- 删除旧的通用 ALL 策略
DROP POLICY IF EXISTS "profiles: own" ON public.profiles;
DROP POLICY IF EXISTS "profiles: public insert" ON public.profiles;
DROP POLICY IF EXISTS "profiles: public update" ON public.profiles;

-- 允许用户 SELECT 自己的 profile
CREATE POLICY "profiles: select own"
  ON public.profiles FOR SELECT
  USING (user_id = auth.uid());

-- 允许用户 INSERT 自己的 profile (主要由 handle_new_user 触发，但保留给客户端权限)
CREATE POLICY "profiles: insert own"
  ON public.profiles FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- 允许用户 DELETE 自己的 profile
CREATE POLICY "profiles: delete own"
  ON public.profiles FOR DELETE
  USING (user_id = auth.uid());

-- 允许用户更新自己的 profile，且禁止客户端直接修改 tier, pro_since, 和 subscription 相关字段
-- 这些敏感字段只能通过 Edge Function (service_role) 更新
CREATE POLICY "profiles: update own non-tier"
  ON public.profiles FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    -- 确保敏感字段在更新前后保持不变
    AND tier = (SELECT tier FROM public.profiles WHERE id = public.profiles.id)
    AND pro_since IS NOT DISTINCT FROM (SELECT pro_since FROM public.profiles WHERE id = public.profiles.id)
    AND subscription_platform IS NOT DISTINCT FROM (SELECT subscription_platform FROM public.profiles WHERE id = public.profiles.id)
    AND subscription_product_id IS NOT DISTINCT FROM (SELECT subscription_product_id FROM public.profiles WHERE id = public.profiles.id)
    AND subscription_expires_at IS NOT DISTINCT FROM (SELECT subscription_expires_at FROM public.profiles WHERE id = public.profiles.id)
    AND subscription_purchase_token IS NOT DISTINCT FROM (SELECT subscription_purchase_token FROM public.profiles WHERE id = public.profiles.id)
  );

COMMENT ON POLICY "profiles: update own non-tier" ON public.profiles 
  IS '允许用户更新自己的 profile，但计费与订阅字段不能通过客户端修改';

/**
 * billing.constants.ts — 付费系统所有常量集中管理
 *
 * 所有与 VIP/计费相关的数字、限制值、价格等均在此文件定义。
 * 修改付费策略时，只需改动此文件。
 */

// ────────────────────────── Free 层级限制 ─────────────────────────

// ────────────────────────── 层级类型 ─────────────────────────

export type UserTier = 'free' | 'pro';

export const TIER_FEATURES: Record<UserTier, {
  maxRooms: number; // For type-safety only, effectively infinite now
  maxMembers: number; // For type-safety only, effectively infinite now
  hasCloudSync: boolean;
  hasAiAnalysis: boolean;
}> = {
  free: {
    maxRooms: 999999, // Infinite
    maxMembers: 999999, // Infinite
    hasCloudSync: false,
    hasAiAnalysis: false,
  },
  pro: {
    maxRooms: 999999,
    maxMembers: 999999,
    hasCloudSync: true,
    hasAiAnalysis: true,
  },
};

// ────────────────────────── AI 额度 ────────────────────────────

// AI is now fully subscription based. No consumable credits.

// ────────────────────────── IAP 商品配置 ─────────────────────────
// 商品 ID は Google Play Console / App Store Connect の設定と完全一致させること。

export const BILLING_CONFIG = {
  /** 月額サブスクリプション商品 ID */
  PRODUCT_ID: 'pro_monthly',

  /** RevenueCat / サーバー側の権限識別子 */
  ENTITLEMENT_ID: 'pro',

  /**
   * サーバーサイド検証 URL（Supabase Edge Function）。
   * 未設定 (空文字) の場合、cordova-plugin-purchase はローカル検証にフォールバックする。
   *
   * TODO(security): 本番リリース前に Edge Function を設定し、
   * Google Play Developer API / App Store Server API で
   * 購入レシートのサーバーサイド二重検証を実装すること。
   */
  VALIDATOR_URL: '',
} as const;

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

// ────────────────────────── 价格配置 ─────────────────────────

export const PRICE_CONFIG = {
  pro: {
    ja: '¥200/月',
    zh: '￥15/月',
    en: '$1.99/mo',
  },
};



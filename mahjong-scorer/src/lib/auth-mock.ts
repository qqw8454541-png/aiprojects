/**
 * auth-mock.ts — Mock Auth 服务
 *
 * 提供与 Supabase Auth 类似的接口签名，但内部使用 localStorage 模拟。
 * 预留 Google、Apple、邮箱验证码、手机验证码 四种登录方式的占位。
 * 后续接入真实 Auth 时，只需替换此文件的实现。
 */

import { safeRandomUUID } from './utils';

// ────────────────────────── Types ──────────────────────────────

export type AuthProvider = 'google' | 'apple' | 'email' | 'phone';

export interface MockUser {
  id: string;
  email?: string;
  phone?: string;
  displayName: string;
  avatarUrl?: string;
  provider: AuthProvider;
  createdAt: string;
}

export interface AuthResult {
  user: MockUser | null;
  error: string | null;
  isNewUser: boolean;
}

// ────────────────────────── Storage Key ────────────────────────

const STORAGE_KEY = 'mahjong-mock-auth';

// ────────────────────────── Mock Implementations ──────────────

/**
 * 模拟登录。
 * 
 * - Google / Apple：直接生成一个假用户，无需任何输入
 * - Email：需要传入 credential 作为邮箱地址
 * - Phone：需要传入 credential 作为手机号
 * 
 * 所有情况均模拟 500ms 网络延迟。
 * 如果该设备之前已经 Mock 登录过，则恢复之前的用户（不是新用户）。
 */
export async function mockSignIn(
  provider: AuthProvider,
  credential?: string
): Promise<AuthResult> {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 500));

  // Check if user already exists in localStorage
  const existing = getMockCurrentUser();
  if (existing) {
    return { user: existing, error: null, isNewUser: false };
  }

  // Generate mock user based on provider
  let user: MockUser;

  switch (provider) {
    case 'google':
      user = {
        id: safeRandomUUID(),
        email: `user_${Math.random().toString(36).slice(2, 8)}@gmail.com`,
        displayName: `GoogleUser_${Math.random().toString(36).slice(2, 6)}`,
        avatarUrl: undefined,
        provider: 'google',
        createdAt: new Date().toISOString(),
      };
      break;

    case 'apple':
      user = {
        id: safeRandomUUID(),
        email: `${Math.random().toString(36).slice(2, 8)}@privaterelay.appleid.com`,
        displayName: `AppleUser_${Math.random().toString(36).slice(2, 6)}`,
        avatarUrl: undefined,
        provider: 'apple',
        createdAt: new Date().toISOString(),
      };
      break;

    case 'email':
      if (!credential || !credential.includes('@')) {
        return { user: null, error: 'invalid_email', isNewUser: false };
      }
      user = {
        id: safeRandomUUID(),
        email: credential,
        displayName: credential.split('@')[0],
        avatarUrl: undefined,
        provider: 'email',
        createdAt: new Date().toISOString(),
      };
      break;

    case 'phone':
      if (!credential || credential.length < 6) {
        return { user: null, error: 'invalid_phone', isNewUser: false };
      }
      user = {
        id: safeRandomUUID(),
        phone: credential,
        displayName: `User_${credential.slice(-4)}`,
        avatarUrl: undefined,
        provider: 'phone',
        createdAt: new Date().toISOString(),
      };
      break;

    default:
      return { user: null, error: 'unknown_provider', isNewUser: false };
  }

  // Persist to localStorage
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  }

  return { user, error: null, isNewUser: true };
}

/**
 * 模拟登出。清除 localStorage 中的 Mock 用户数据。
 */
export async function mockSignOut(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 200));
  if (typeof window !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY);
  }
}

/**
 * 获取当前 Mock 登录用户。
 * 返回 null 表示未登录。
 */
export function getMockCurrentUser(): MockUser | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as MockUser;
  } catch {
    return null;
  }
}

/**
 * 模拟发送验证码（邮箱或手机）。
 * Mock 实现：始终成功，验证码固定为 "888888"。
 */
export async function mockSendVerificationCode(
  _type: 'email' | 'phone',
  _target: string
): Promise<{ success: boolean; error?: string }> {
  await new Promise((resolve) => setTimeout(resolve, 800));
  // Always succeed in mock mode
  return { success: true };
}

/**
 * 模拟验证码校验。
 * Mock 实现：任何 6 位数字均视为正确。
 */
export function mockVerifyCode(_code: string): boolean {
  return _code.length === 6 && /^\d+$/.test(_code);
}

'use client';

/**
 * billing-service.ts — 跨平台应用内购买 (IAP) 服务
 *
 * 使用 cordova-plugin-purchase (MIT, OSS) 统一封装：
 *   - Android: Google Play Billing Library
 *   - iOS:     Apple StoreKit 2
 *
 * Web 端不支持原生购买，purchasePro() 会直接返回 web_not_supported。
 *
 * 使用方式：
 *   import { billingService } from '@/lib/billing-service';
 *   await billingService.init();
 *   const result = await billingService.purchasePro();
 */

import { Capacitor } from '@capacitor/core';
import { BILLING_CONFIG } from './billing.constants';

// ─── CdvPurchase type shims ─────────────────────────────────────────
// cordova-plugin-purchase v13+ 在全局暴露 CdvPurchase 命名空间。
// 这里只声明我们用到的部分，避免在 SSR / web 端引用报错。

/* eslint-disable @typescript-eslint/no-explicit-any */
interface CdvPurchaseGlobal {
  store: any;
  ProductType: { PAID_SUBSCRIPTION: string; NON_CONSUMABLE: string };
  Platform: { GOOGLE_PLAY: string; APPLE_APPSTORE: string };
  LogLevel: { DEBUG: number; INFO: number; WARNING: number };
}

function getCdvPurchase(): CdvPurchaseGlobal | null {
  if (typeof window === 'undefined') return null;
  return (window as any).CdvPurchase ?? null;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// ─── Public types ───────────────────────────────────────────────────

export interface PurchaseResult {
  success: boolean;
  /** Error code for programmatic handling */
  error?: string;
  /** Human-readable error message */
  message?: string;
}

export interface SubscriptionStatus {
  isActive: boolean;
  productId?: string;
  expiresAt?: string;
  platform?: 'android' | 'ios';
}

type EntitlementChangeCallback = (isEntitled: boolean) => void;

// ─── BillingService ─────────────────────────────────────────────────

class BillingServiceImpl {
  private initialized = false;
  private initPromise: Promise<void> | null = null;
  private listeners = new Set<EntitlementChangeCallback>();

  // Promise 控制：purchasePro() 等待购买流程完成
  private purchaseResolve: ((r: PurchaseResult) => void) | null = null;
  private purchaseTimeout: ReturnType<typeof setTimeout> | null = null;

  /** 是否运行在原生平台 */
  get isNative(): boolean {
    return Capacitor.getPlatform() !== 'web';
  }

  // ── 初始化 ──────────────────────────────────────────────────────

  /**
   * 初始化付费 SDK。应在 app 启动时调用一次（auth-store.initialize 中）。
   * 重复调用安全，内部做了幂等保护。
   */
  async init(): Promise<void> {
    if (!this.isNative) return;
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this._doInit();
    return this.initPromise;
  }

  private async _doInit(): Promise<void> {
    const cdv = getCdvPurchase();
    if (!cdv) {
      console.warn('[billing] CdvPurchase not available — skipping init');
      return;
    }

    const { store, ProductType, Platform } = cdv;
    const platform = Capacitor.getPlatform() === 'android'
      ? Platform.GOOGLE_PLAY
      : Platform.APPLE_APPSTORE;

    // 注册商品
    store.register([{
      id: BILLING_CONFIG.PRODUCT_ID,
      type: ProductType.PAID_SUBSCRIPTION,
      platform,
    }]);

    // 设置验证服务器 (可选 — 如有 Edge Function 则填入)
    if (BILLING_CONFIG.VALIDATOR_URL) {
      store.validator = BILLING_CONFIG.VALIDATOR_URL;
    }

    // 事件处理链
    store.when()
      .approved((transaction: any) => {
        // 商店已批准购买，触发验证
        transaction.verify();
      })
      .verified(async (receipt: any) => {
        // 验证通过 — 更新后端
        try {
          await this._handleVerifiedPurchase(receipt);
        } catch (e) {
          console.error('[billing] handleVerifiedPurchase failed:', e);
        }
        receipt.finish();
      })
      .unverified((receipt: any) => {
        // 验证失败
        console.error('[billing] Purchase verification failed:', receipt);
        this._resolvePurchase({ success: false, error: 'verification_failed' });
      })
      .finished(() => {
        // 交易完成（finish 后触发）
        this.notifyListeners(true);
        this._resolvePurchase({ success: true });
      });

    // 初始化商店
    try {
      await store.initialize([platform]);
      this.initialized = true;
      console.log('[billing] SDK initialized on platform:', Capacitor.getPlatform());
    } catch (e) {
      console.error('[billing] Initialization failed:', e);
    }
  }

  // ── 购买 Pro ────────────────────────────────────────────────────

  /**
   * 发起 Pro 订阅购买。
   *
   * 返回 Promise，在购买成功 / 失败 / 取消后 resolve。
   * Web 端直接返回 { success: false, error: 'web_not_supported' }。
   */
  async purchasePro(): Promise<PurchaseResult> {
    if (!this.isNative) {
      return { success: false, error: 'web_not_supported', message: 'Please purchase in the mobile app.' };
    }

    const cdv = getCdvPurchase();
    if (!cdv) {
      return { success: false, error: 'sdk_not_available' };
    }

    // 确保已初始化
    await this.init();

    const { store } = cdv;
    const product = store.get(BILLING_CONFIG.PRODUCT_ID);
    if (!product) {
      return { success: false, error: 'product_not_found', message: 'Subscription product not configured in store.' };
    }

    const offer = product.getOffer();
    if (!offer) {
      return { success: false, error: 'no_offer', message: 'No pricing offer available.' };
    }

    // 创建 Promise 等待购买流程走完
    return new Promise<PurchaseResult>((resolve) => {
      this.purchaseResolve = resolve;

      // 超时保护（2 分钟无响应则超时）
      this.purchaseTimeout = setTimeout(() => {
        this._resolvePurchase({ success: false, error: 'timeout', message: 'Purchase timed out.' });
      }, 120_000);

      store.order(offer).then((error: any) => {
        if (error) {
          // order() 本身返回错误（如用户取消）
          this._resolvePurchase({
            success: false,
            error: error.code === 6777001 ? 'user_cancelled' : 'order_failed',
            message: error.message || 'Purchase could not be started.',
          });
        }
        // 无错误 → 购买流程继续在事件链中处理
      });
    });
  }

  // ── 恢复购买 ────────────────────────────────────────────────────

  /**
   * 恢复购买。
   * iOS App Store 审核强制要求提供此功能。Android 也建议提供。
   *
   * @returns true 如果恢复后检测到有效的 Pro 权限
   */
  async restorePurchases(): Promise<boolean> {
    if (!this.isNative) return false;

    const cdv = getCdvPurchase();
    if (!cdv) return false;

    await this.init();

    try {
      await cdv.store.restorePurchases();
      const owned = this.checkEntitlement();
      this.notifyListeners(owned);
      return owned;
    } catch (e) {
      console.error('[billing] Restore purchases failed:', e);
      return false;
    }
  }

  // ── 权限检查 ────────────────────────────────────────────────────

  /**
   * 检查本地商店状态中是否拥有 Pro 权限。
   * 这是客户端缓存，不保证和服务端完全同步。
   */
  checkEntitlement(): boolean {
    if (!this.isNative) return false;

    const cdv = getCdvPurchase();
    if (!cdv || !this.initialized) return false;

    const product = cdv.store.get(BILLING_CONFIG.PRODUCT_ID);
    return product?.owned === true;
  }

  // ── 动态价格 ────────────────────────────────────────────────────

  /**
   * 从商店获取本地化的价格字符串（如 "$1.99" / "¥200"）。
   * 返回 null 表示无法获取（web 端或 SDK 未初始化）。
   */
  getLocalizedPrice(): string | null {
    if (!this.isNative) return null;

    const cdv = getCdvPurchase();
    if (!cdv || !this.initialized) return null;

    const product = cdv.store.get(BILLING_CONFIG.PRODUCT_ID);
    const offer = product?.getOffer();
    return offer?.pricingPhases?.[0]?.price
      ?? product?.pricing?.price
      ?? null;
  }

  // ── 监听器 ──────────────────────────────────────────────────────

  /**
   * 注册权限变更回调。返回取消注册函数。
   */
  onEntitlementChanged(callback: EntitlementChangeCallback): () => void {
    this.listeners.add(callback);
    return () => { this.listeners.delete(callback); };
  }

  private notifyListeners(isEntitled: boolean) {
    this.listeners.forEach((cb) => {
      try { cb(isEntitled); } catch (e) { console.error('[billing] listener error:', e); }
    });
  }

  // ── 内部工具 ────────────────────────────────────────────────────

  private _resolvePurchase(result: PurchaseResult) {
    if (this.purchaseTimeout) {
      clearTimeout(this.purchaseTimeout);
      this.purchaseTimeout = null;
    }
    if (this.purchaseResolve) {
      this.purchaseResolve(result);
      this.purchaseResolve = null;
    }
  }

  /**
   * 验证通过后的后端同步。
   *
   * TODO(security): 当前通过客户端直接 upsert profiles.tier，
   * 正式上线前应改为通过 Supabase Edge Function 做服务端收据二次验证，
   * 并收紧 RLS 策略（禁止客户端直接更新 tier 字段）。
   */
  private async _handleVerifiedPurchase(_receipt: any): Promise<void> {
    const { useAuthStore } = await import('./auth-store');
    const user = useAuthStore.getState().user;
    if (!user) {
      console.warn('[billing] No authenticated user — skipping backend sync');
      return;
    }

    const { supabase } = await import('./supabase');
    const { error } = await supabase
      .from('profiles')
      .upsert(
        {
          user_id: user.id,
          tier: 'pro',
          pro_since: new Date().toISOString(),
          subscription_platform: Capacitor.getPlatform() as 'android' | 'ios',
          subscription_product_id: BILLING_CONFIG.PRODUCT_ID,
        },
        { onConflict: 'user_id' }
      );

    if (error) {
      console.error('[billing] Failed to update profile tier:', error);
    }
  }
}

// 单例导出
export const billingService = new BillingServiceImpl();

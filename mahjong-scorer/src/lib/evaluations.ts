// This function runs client-side (no "use server") to support both web and static APK builds.
// Requires NEXT_PUBLIC_LLM_API_URL and NEXT_PUBLIC_LLM_API_SECRET in .env.local / Vercel environment.
import type { ScoringContext } from './llm.config';

export type Locale = 'zh' | 'ja' | 'en';

export interface PlayerEvalStats {
  playerId: string;
  playerName: string;
  pt: number;
  rank: number;
  history: number[];
}

/** LLM API 请求的超时时间 (ms) */
const REQUEST_TIMEOUT_MS = 30_000;

/** 遇到可重试错误时的最大重试次数 */
const MAX_RETRIES = 1;

/** 重试前等待的延迟 (ms) */
const RETRY_DELAY_MS = 2_000;

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

export async function getEvaluationsBatch(
  players: PlayerEvalStats[], 
  locale: string, 
  scoringCtx?: ScoringContext
): Promise<{ data?: Record<string, string>, error?: string, details?: string }> {
  // Use custom external API to prevent Gemini API Key exposure in APK
  const apiUrl = process.env.NEXT_PUBLIC_LLM_API_URL;
  const apiSecret = process.env.NEXT_PUBLIC_LLM_API_SECRET;

  if (!apiUrl || !apiSecret) {
    console.error("Missing NEXT_PUBLIC_LLM_API_URL or NEXT_PUBLIC_LLM_API_SECRET in environment");
    return { 
      error: 'NETWORK_ERROR', 
      details: 'Missing NEXT_PUBLIC_LLM_API_URL or NEXT_PUBLIC_LLM_API_SECRET in client environment variables.' 
    };
  }

  let lastError: any = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        console.info(`[evaluations] Retry attempt ${attempt}/${MAX_RETRIES}`);
        await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
      }

      const response = await fetchWithTimeout(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiSecret}`
        },
        body: JSON.stringify({
          players,
          locale,
          scoringCtx
        })
      }, REQUEST_TIMEOUT_MS);

      if (!response.ok) {
        let errBody: any = null;
        try {
          errBody = await response.json();
        } catch (_) {}

        const errorType = errBody?.error || (response.status === 429 ? 'RATE_LIMIT_EXCEEDED' : 'SERVICE_ERROR');
        const details = errBody?.message || `HTTP Request failed with status ${response.status} (${response.statusText})`;

        // 429 和 401 不重试
        if (response.status === 429 || response.status === 401) {
          return { error: errorType, details };
        }

        // 5xx 可重试
        if (response.status >= 500 && attempt < MAX_RETRIES) {
          lastError = { error: errorType, details };
          continue;
        }

        return { error: errorType, details };
      }

      const json = await response.json();
      if (json.data) {
        return { data: json.data as Record<string, string> };
      }
      
      return { 
        error: 'SERVICE_ERROR', 
        details: 'Server returned success status but missing valid data payload.' 
      };
    } catch (error: any) {
      lastError = error;
      console.warn(`[evaluations] Request error (attempt ${attempt + 1}):`, error?.message || error);

      // AbortError = timeout
      if (error?.name === 'AbortError') {
        if (attempt < MAX_RETRIES) continue;
        return {
          error: 'NETWORK_ERROR',
          details: `Request timed out after ${REQUEST_TIMEOUT_MS / 1000}s. Please check your network connection.`
        };
      }

      // TypeError = fetch failure (CORS, network, DNS etc.)
      if (error?.name === 'TypeError' || (error?.message && error.message.includes('fetch'))) {
        if (attempt < MAX_RETRIES) continue;
        return { 
          error: 'NETWORK_ERROR', 
          details: `Failed to connect to LLM server: ${error?.message || error}. This may be caused by network restrictions or CORS policy.` 
        };
      }

      // Other errors — don't retry
      return { 
        error: 'UNKNOWN_ERROR', 
        details: error?.message || String(error) 
      };
    }
  }

  // Should not reach here, but just in case
  return {
    error: 'UNKNOWN_ERROR',
    details: lastError?.message || 'All retry attempts exhausted'
  };
}

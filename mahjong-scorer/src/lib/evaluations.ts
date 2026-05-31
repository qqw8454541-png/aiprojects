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

  try {
    const response = await fetch(apiUrl, {
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
    });

    if (!response.ok) {
      let errBody: any = null;
      try {
        errBody = await response.json();
      } catch (_) {}

      const errorType = errBody?.error || (response.status === 429 ? 'RATE_LIMIT_EXCEEDED' : 'SERVICE_ERROR');
      const details = errBody?.message || `HTTP Request failed with status ${response.status} (${response.statusText})`;

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
    console.warn("Evaluation batch generation error:", error?.message || error);
    if (error?.name === 'TypeError' || (error?.message && error.message.includes('fetch'))) {
      return { 
        error: 'NETWORK_ERROR', 
        details: `Failed to connect to LLM server: ${error?.message || error}` 
      };
    }
    return { 
      error: 'UNKNOWN_ERROR', 
      details: error?.message || String(error) 
    };
  }
}

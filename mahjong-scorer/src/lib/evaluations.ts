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

export async function getEvaluationsBatch(players: PlayerEvalStats[], locale: string, scoringCtx?: ScoringContext): Promise<{ data?: Record<string, string>, error?: string }> {
  // Use custom external API to prevent Gemini API Key exposure in APK
  const apiUrl = process.env.NEXT_PUBLIC_LLM_API_URL || 'http://localhost:3002/api/evaluate';
  const apiSecret = process.env.NEXT_PUBLIC_LLM_API_SECRET || 'dev-secret-key-123';

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
      if (response.status === 429) {
        return { error: 'QUOTA_EXCEEDED' };
      }
      return { error: 'GENERAL_API_ERROR' };
    }

    const json = await response.json();
    if (json.data) {
      return { data: json.data as Record<string, string> };
    }
    
    return { error: 'GENERAL_API_ERROR' };
  } catch (error: any) {
    console.warn("Evaluation batch generation error:", error?.message || error);
    if (error?.name === 'TypeError' || (error?.message && error.message.includes('fetch'))) {
      return { error: 'CONNECTION_FAILED' };
    }
    return { error: 'GENERAL_API_ERROR' };
  }
}

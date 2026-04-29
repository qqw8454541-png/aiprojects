"use server";

import { LLM_CONFIG } from './llm.config';

export type Locale = 'zh' | 'ja' | 'en';

export interface PlayerEvalStats {
  playerId: string;
  playerName: string;
  pt: number;
  rank: number;
  history: number[];
}

export async function getEvaluationsBatch(players: PlayerEvalStats[], locale: string): Promise<{ data?: Record<string, string>, error?: string }> {
  const lang = (locale === 'ja' || locale === 'zh') ? locale : 'en';
  const langName = lang === 'zh' ? 'Simplified Chinese' : lang === 'ja' ? 'Japanese' : 'English';
  
  const apiKey = LLM_CONFIG.getApiKey();
  if (!apiKey) {
    return { error: 'NO_API_KEY' };
  }

  const prompt = LLM_CONFIG.buildPrompt(JSON.stringify(players, null, 2), langName);
  const apiUrl = LLM_CONFIG.buildApiUrl(LLM_CONFIG.MODEL_ID, apiKey);

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          temperature: 0.8,
        }
      })
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("LLM API Error:", response.status, text);
      if (response.status === 429) {
        return { error: 'QUOTA_EXCEEDED' };
      }
      return { error: 'GENERAL_API_ERROR' };
    }

    const data = await response.json();
    if (data?.candidates?.[0]?.content?.parts?.[0]?.text) {
      const resultText = data.candidates[0].content.parts[0].text;
      
      // Robust JSON extraction to handle models that ignore the "No markdown" instruction
      const jsonMatch = resultText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error("LLM output did not contain a valid JSON block:", resultText);
        return { error: 'JSON_FORMAT_ERROR' };
      }
      
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        return { data: parsed as Record<string, string> };
      } catch (parseError) {
        console.error("Failed to parse extracted JSON block:", jsonMatch[0], parseError);
        return { error: 'JSON_FORMAT_ERROR' };
      }
    }
    return { error: 'GENERAL_API_ERROR' };
  } catch (error: any) {
    console.error("Evaluation batch generation error:", error);
    return { error: 'GENERAL_API_ERROR' };
  }
}

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';
import { LLM_CONFIG, type ScoringContext } from '../src/llm.config';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const AUTH_SECRET = process.env.LLM_API_SECRET || 'dev-secret-key-123';

// Initialize Redis using environment variables. 
// Note: When deploying to Vercel, make sure to add UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN to the environment.
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || 'https://eternal-antelope-106176.upstash.io',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || 'gQAAAAAAAZ7AAAIgcDE5YTlkNmFhMzQ3MzI0YjZkOGE0NDRmNWEzMTc4M2RiMw'
});

import { rateLimitConfig } from '../src/rate-limit.config';

// 1. Minute-level limiter (prevent burst attacks)
const minuteRateLimit = new Ratelimit({
  redis: redis,
  limiter: Ratelimit.slidingWindow(rateLimitConfig.minuteLimit, '1 m'),
  analytics: false,
  prefix: '@upstash/ratelimit/minute'
});

// 2. Daily-level limiter (prevent slow draining)
const dailyRateLimit = new Ratelimit({
  redis: redis,
  limiter: Ratelimit.slidingWindow(rateLimitConfig.dailyLimit, '1 d'),
  analytics: false,
  prefix: '@upstash/ratelimit/daily'
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS setup
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*'); 
  res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-forwarded-for');

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'NETWORK_ERROR', message: 'Method Not Allowed' });
    return;
  }

  // Extract Client IP
  // Vercel populates x-forwarded-for automatically
  const forwardedFor = req.headers['x-forwarded-for'] || req.headers['x-real-ip'];
  let ip = 'unknown-ip';
  if (typeof forwardedFor === 'string') {
    ip = forwardedFor.split(',')[0].trim();
  } else if (Array.isArray(forwardedFor)) {
    ip = forwardedFor[0].trim();
  } else if (req.socket?.remoteAddress) {
    ip = req.socket.remoteAddress;
  }

  try {
    // Rate Limiting Check
    if (rateLimitConfig.enabled) {
      // Prioritize userId if available in payload, fallback to IP
      const identifier = req.body?.userId || ip;

      const [minuteResult, dailyResult] = await Promise.all([
        minuteRateLimit.limit(identifier),
        dailyRateLimit.limit(identifier)
      ]);
      
      if (!minuteResult.success || !dailyResult.success) {
        console.warn(`[RATE LIMIT EXCEEDED] Identifier: ${identifier}. Minute: ${minuteResult.success}, Daily: ${dailyResult.success}`);
        res.status(429).json({ error: 'RATE_LIMIT_EXCEEDED', message: 'Too Many Requests' });
        return;
      }
    }
    // --- PROCEED WITH NORMAL API LOGIC ---

    // Authentication
    const authHeader = req.headers.authorization;
    if (!authHeader || authHeader !== `Bearer ${AUTH_SECRET}`) {
      res.status(401).json({ error: 'NETWORK_ERROR', message: 'Unauthorized client credentials' });
      return;
    }

    if (!GEMINI_API_KEY) {
      res.status(500).json({ error: 'SERVICE_ERROR', message: 'Server configuration error: No Gemini API Key' });
      return;
    }

    const { players, locale, scoringCtx } = req.body;

    if (!players || !Array.isArray(players)) {
      res.status(400).json({ error: 'NETWORK_ERROR', message: 'Invalid players data' });
      return;
    }

    const lang = (locale === 'ja' || locale === 'zh') ? locale : 'en';
    const langName = lang === 'zh' ? 'Simplified Chinese' : lang === 'ja' ? 'Japanese' : 'English';

    const prompt = LLM_CONFIG.buildPrompt(JSON.stringify(players, null, 2), langName, scoringCtx);
    const apiUrl = LLM_CONFIG.buildApiUrl(LLM_CONFIG.MODEL_ID, GEMINI_API_KEY);

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
          temperature: 1.2,
          topP: 0.95,
        }
      })
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`LLM API Error [${response.status}]:`, text);
      if (response.status === 429) {
        res.status(429).json({ error: 'RATE_LIMIT_EXCEEDED', message: 'Gemini Quota Exceeded' });
        return;
      }
      res.status(500).json({ error: 'SERVICE_ERROR', message: `Gemini API Error: ${text}` });
      return;
    }

    const data: any = await response.json();
    if (data?.candidates?.[0]?.content?.parts?.[0]?.text) {
      const resultText = data.candidates[0].content.parts[0].text;
      
      const jsonMatch = resultText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error("LLM output did not contain a valid JSON block:", resultText);
        res.status(500).json({ error: 'SERVICE_ERROR', message: 'Failed to extract valid JSON block from LLM output.' });
        return;
      }
      
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        res.status(200).json({ data: parsed });
        return;
      } catch (parseError: any) {
        console.error("Failed to parse extracted JSON block:", jsonMatch[0], parseError);
        res.status(500).json({ error: 'SERVICE_ERROR', message: `JSON format parsing failed: ${parseError?.message || parseError}` });
        return;
      }
    }
    res.status(500).json({ error: 'SERVICE_ERROR', message: 'No content candidate generated by LLM' });
  } catch (error: any) {
    console.error("Evaluation API error:", error);
    res.status(500).json({ error: 'UNKNOWN_ERROR', message: error?.message || 'Unknown server catch error' });
  }
}

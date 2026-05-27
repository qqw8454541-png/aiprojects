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

// Create a new ratelimiter that allows 10 requests per 1 minute
const ratelimit = new Ratelimit({
  redis: redis,
  limiter: Ratelimit.slidingWindow(10, '1 m'),
  analytics: false,
});

// Threshold for permanent ban: 3 rate-limit violations
const BAN_THRESHOLD = 3;

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
    res.status(405).json({ error: 'Method Not Allowed' });
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
    // 1. Check Blocklist (Fail2Ban Check)
    /*
    const isBanned = await redis.sismember('banned_ips', ip);
    if (isBanned) {
      console.warn(`[BLOCKED] Request from banned IP: ${ip}`);
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    // 2. Rate Limiting Check
    const { success } = await ratelimit.limit(`ratelimit:${ip}`);
    
    if (!success) {
      const violations = await redis.incr(`violations:${ip}`);
      if (violations === 1) {
        await redis.expire(`violations:${ip}`, 3600); // 1 hour
      }
      console.warn(`[RATE LIMIT] IP ${ip} exceeded limit. Violation count: ${violations}`);
      if (violations >= BAN_THRESHOLD) {
        await redis.sadd('banned_ips', ip);
        console.error(`[BANNED] IP ${ip} has been permanently banned due to excessive violations.`);
      }
      res.status(429).json({ error: 'Too Many Requests' });
      return;
    }
    */
    // --- PROCEED WITH NORMAL API LOGIC ---

    // Authentication
    const authHeader = req.headers.authorization;
    if (!authHeader || authHeader !== `Bearer ${AUTH_SECRET}`) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!GEMINI_API_KEY) {
      res.status(500).json({ error: 'Server configuration error: No Gemini API Key' });
      return;
    }

    const { players, locale, scoringCtx } = req.body;

    if (!players || !Array.isArray(players)) {
      res.status(400).json({ error: 'Invalid players data' });
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
        res.status(429).json({ error: 'QUOTA_EXCEEDED' });
        return;
      }
      res.status(500).json({ error: 'GENERAL_API_ERROR' });
      return;
    }

    const data: any = await response.json();
    if (data?.candidates?.[0]?.content?.parts?.[0]?.text) {
      const resultText = data.candidates[0].content.parts[0].text;
      
      const jsonMatch = resultText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error("LLM output did not contain a valid JSON block:", resultText);
        res.status(500).json({ error: 'JSON_FORMAT_ERROR' });
        return;
      }
      
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        res.status(200).json({ data: parsed });
        return;
      } catch (parseError) {
        console.error("Failed to parse extracted JSON block:", jsonMatch[0], parseError);
        res.status(500).json({ error: 'JSON_FORMAT_ERROR' });
        return;
      }
    }
    res.status(500).json({ error: 'GENERAL_API_ERROR' });
  } catch (error: any) {
    console.error("Evaluation API error:", error);
    res.status(500).json({ error: 'GENERAL_API_ERROR' });
  }
}

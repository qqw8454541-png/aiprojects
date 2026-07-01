process.env.GEMINI_API_KEY = 'test-api-key';
process.env.LLM_API_SECRET = 'dev-secret-key-123';

import { createRequest, createResponse } from 'node-mocks-http';
import handler from '../api/evaluate';

jest.mock('@upstash/ratelimit', () => {
  const limitMock = jest.fn();
  const RatelimitClass = jest.fn().mockImplementation(() => ({
    limit: limitMock
  }));
  (RatelimitClass as any).slidingWindow = jest.fn();
  (RatelimitClass as any).mockLimit = limitMock;
  return {
    Ratelimit: RatelimitClass
  };
});
import { Ratelimit } from '@upstash/ratelimit';
const mockLimit = (Ratelimit as any).mockLimit;

jest.mock('../src/llm.config', () => {
  return {
    LLM_CONFIG: {
      MODEL_ID: 'test-model',
      buildPrompt: jest.fn().mockReturnValue('test prompt'),
      buildApiUrl: jest.fn().mockReturnValue('http://test-url.com/api')
    }
  };
});

jest.mock('../src/rate-limit.config', () => {
  return {
    rateLimitConfig: {
      enabled: true,
      minuteLimit: 10,
      dailyLimit: 100
    }
  };
});

const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('evaluate.ts handler', () => {
  let req: any;
  let res: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    req = createRequest({
      method: 'POST',
      headers: {
        authorization: 'Bearer dev-secret-key-123'
      },
      body: {
        players: [{}],
        locale: 'en'
      }
    });
    
    res = createResponse();
    
    mockLimit.mockResolvedValue({ success: true });
    
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{
          content: {
            parts: [{ text: '{"test": "data"}' }]
          }
        }]
      })
    } as any);
  });

  it('should handle OPTIONS request', async () => {
    req.method = 'OPTIONS';
    await handler(req as any, res as any);
    expect(res.statusCode).toBe(200);
    expect(res._isEndCalled()).toBeTruthy();
  });

  it('should reject non-POST requests', async () => {
    req.method = 'GET';
    await handler(req as any, res as any);
    expect(res.statusCode).toBe(405);
    expect(res._getJSONData()).toEqual({ error: 'NETWORK_ERROR', message: 'Method Not Allowed' });
  });

  describe('IP Extraction', () => {
    it('should extract IP from x-forwarded-for string', async () => {
      req.headers['x-forwarded-for'] = '1.2.3.4, 5.6.7.8';
      await handler(req as any, res as any);
      expect(mockLimit).toHaveBeenCalledWith(req.body.userId || '1.2.3.4');
    });

    it('should extract IP from x-forwarded-for array', async () => {
      req.headers['x-forwarded-for'] = ['2.3.4.5', '6.7.8.9'];
      await handler(req as any, res as any);
      expect(mockLimit).toHaveBeenCalledWith(req.body.userId || '2.3.4.5');
    });

    it('should fallback to remoteAddress', async () => {
      delete req.headers['x-forwarded-for'];
      req.socket = { remoteAddress: '3.4.5.6' };
      await handler(req as any, res as any);
      expect(mockLimit).toHaveBeenCalledWith(req.body.userId || '3.4.5.6');
    });

    it('should fallback to unknown-ip', async () => {
      delete req.headers['x-forwarded-for'];
      req.socket = {};
      await handler(req as any, res as any);
      expect(mockLimit).toHaveBeenCalledWith(req.body.userId || 'unknown-ip');
    });
  });

  describe('Rate Limiting', () => {
    it('should return 429 if rate limit exceeded', async () => {
      mockLimit.mockResolvedValueOnce({ success: false }).mockResolvedValueOnce({ success: true });
      await handler(req as any, res as any);
      expect(res.statusCode).toBe(429);
      expect(res._getJSONData()).toEqual({ error: 'RATE_LIMIT_EXCEEDED', message: 'Too Many Requests' });
    });

    it('should bypass rate limit if disabled', async () => {
      const { rateLimitConfig } = require('../src/rate-limit.config');
      rateLimitConfig.enabled = false;
      await handler(req as any, res as any);
      expect(res.statusCode).toBe(200); // Because it bypasses and hits the end successfully
      rateLimitConfig.enabled = true; // restore
    });
  });

  describe('Authentication and Configuration', () => {
    it('should return 401 if unauthorized', async () => {
      req.headers.authorization = 'Bearer wrong';
      await handler(req as any, res as any);
      expect(res.statusCode).toBe(401);
    });

    it('should return 401 if missing auth header', async () => {
      delete req.headers.authorization;
      await handler(req as any, res as any);
      expect(res.statusCode).toBe(401);
    });

    it('should return 500 if GEMINI_API_KEY is missing', () => {
      let isolateRes: any = createResponse();
      jest.isolateModules(() => {
        process.env.GEMINI_API_KEY = '';
        const handlerWithoutKey = require('../api/evaluate').default;
        
        return handlerWithoutKey(req, isolateRes).then(() => {
          expect(isolateRes.statusCode).toBe(500);
          expect(isolateRes._getJSONData()).toEqual({ error: 'SERVICE_ERROR', message: 'Server configuration error: No Gemini API Key' });
        });
      });
      process.env.GEMINI_API_KEY = 'test-api-key';
    });
  });

  describe('Validation', () => {
    it('should return 400 if players is missing', async () => {
      delete req.body.players;
      await handler(req as any, res as any);
      expect(res.statusCode).toBe(400);
    });

    it('should return 400 if players is not an array', async () => {
      req.body.players = 'not-array';
      await handler(req as any, res as any);
      expect(res.statusCode).toBe(400);
    });
  });

  describe('Locale & Prompt Logic', () => {
    it('should handle ja locale', async () => {
      const { LLM_CONFIG } = require('../src/llm.config');
      req.body.locale = 'ja';
      await handler(req as any, res as any);
      expect(LLM_CONFIG.buildPrompt).toHaveBeenCalledWith(expect.any(String), 'Japanese', undefined);
    });

    it('should handle zh locale', async () => {
      const { LLM_CONFIG } = require('../src/llm.config');
      req.body.locale = 'zh';
      await handler(req as any, res as any);
      expect(LLM_CONFIG.buildPrompt).toHaveBeenCalledWith(expect.any(String), 'Simplified Chinese', undefined);
    });

    it('should fallback to English for unknown locale', async () => {
      const { LLM_CONFIG } = require('../src/llm.config');
      req.body.locale = 'fr';
      await handler(req as any, res as any);
      expect(LLM_CONFIG.buildPrompt).toHaveBeenCalledWith(expect.any(String), 'English', undefined);
    });
  });

  describe('Fetch & LLM Results', () => {
    it('should return 429 if Gemini API Quota Exceeded', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: async () => 'Quota Exceeded'
      } as any);
      await handler(req as any, res as any);
      expect(res.statusCode).toBe(429);
      expect(res._getJSONData()).toEqual({ error: 'RATE_LIMIT_EXCEEDED', message: 'Gemini Quota Exceeded' });
    });

    it('should retry on 503 and succeed if subsequent call is OK', async () => {
      // First call fails with 503
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        text: async () => 'Service Unavailable'
      } as any);
      
      // Second call succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [{
            content: {
              parts: [{ text: '{"success": true}' }]
            }
          }]
        })
      } as any);

      // We should mock setTimeout to not wait for 1000ms in test
      jest.useFakeTimers();
      const handlerPromise = handler(req as any, res as any);
      
      // Wait for the next tick to allow promise to settle and setTimeout to be called
      await Promise.resolve();
      jest.runAllTimers();
      jest.useRealTimers();

      await handlerPromise;

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(res.statusCode).toBe(200);
      expect(res._getJSONData()).toEqual({ data: { success: true } });
    });

    it('should return 500 for other Gemini API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => 'Bad Request'
      } as any);
      await handler(req as any, res as any);
      expect(res.statusCode).toBe(500);
      expect(res._getJSONData()).toEqual({ error: 'SERVICE_ERROR', message: 'Gemini API Error: Bad Request' });
    });

    it('should return 500 if no valid json block is found in LLM output', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [{
            content: {
              parts: [{ text: 'no json here' }]
            }
          }]
        })
      } as any);
      await handler(req as any, res as any);
      expect(res.statusCode).toBe(500);
      expect(res._getJSONData()).toEqual({ error: 'SERVICE_ERROR', message: 'Failed to extract valid JSON block from LLM output.' });
    });

    it('should return 500 if JSON parse fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [{
            content: {
              parts: [{ text: '{ bad json }' }]
            }
          }]
        })
      } as any);
      await handler(req as any, res as any);
      expect(res.statusCode).toBe(500);
      expect(res._getJSONData().message).toMatch(/JSON format parsing failed/);
    });

    it('should return 500 if JSON parse fails with string error (no message property)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [{
            content: {
              parts: [{ text: '{ "a": 1 }' }]
            }
          }]
        })
      } as any);
      const originalParse = JSON.parse;
      const spy = jest.spyOn(JSON, 'parse').mockImplementation((text) => {
        if (text === '{ "a": 1 }') throw 'String Error';
        return originalParse(text);
      });
      await handler(req as any, res as any);
      expect(res.statusCode).toBe(500);
      expect(res._getJSONData().message).toBe('JSON format parsing failed: String Error');
      spy.mockRestore();
    });

    it('should return 500 if no candidate is generated', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: []
        })
      } as any);
      await handler(req as any, res as any);
      expect(res.statusCode).toBe(500);
      expect(res._getJSONData()).toEqual({ error: 'SERVICE_ERROR', message: 'No content candidate generated by LLM' });
    });

    it('should return 200 with parsed JSON data on success', async () => {
      await handler(req as any, res as any);
      expect(res.statusCode).toBe(200);
      expect(res._getJSONData()).toEqual({ data: { test: 'data' } });
    });
    
    it('should handle unhandled catch block', async () => {
        mockFetch.mockRejectedValueOnce(new Error('Network failure'));
        await handler(req as any, res as any);
        expect(res.statusCode).toBe(500);
        expect(res._getJSONData()).toEqual({ error: 'UNKNOWN_ERROR', message: 'Network failure' });
    });

    it('should handle unhandled catch block with string error (no message property)', async () => {
        mockFetch.mockRejectedValueOnce('String Catch Error');
        await handler(req as any, res as any);
        expect(res.statusCode).toBe(500);
        expect(res._getJSONData()).toEqual({ error: 'UNKNOWN_ERROR', message: 'Unknown server catch error' });
    });
  });
});

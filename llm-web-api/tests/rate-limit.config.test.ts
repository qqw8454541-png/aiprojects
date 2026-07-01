import { rateLimitConfig } from '../src/rate-limit.config';

describe('rateLimitConfig', () => {
  it('should have the correct structure and default values', () => {
    expect(rateLimitConfig).toHaveProperty('minuteLimit');
    expect(typeof rateLimitConfig.minuteLimit).toBe('number');
    
    expect(rateLimitConfig).toHaveProperty('dailyLimit');
    expect(typeof rateLimitConfig.dailyLimit).toBe('number');
    
    expect(rateLimitConfig).toHaveProperty('enabled');
    expect(typeof rateLimitConfig.enabled).toBe('boolean');
  });

  it('should match expected default limits', () => {
    // Expected defaults based on current implementation
    expect(rateLimitConfig.minuteLimit).toBe(5);
    expect(rateLimitConfig.dailyLimit).toBe(100);
    expect(rateLimitConfig.enabled).toBe(true);
  });
});

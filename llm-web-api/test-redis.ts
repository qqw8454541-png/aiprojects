import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';
import * as dotenv from 'dotenv';
import { rateLimitConfig } from './src/rate-limit.config';

dotenv.config({ path: '.env.local' });

const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

if (!redisUrl || !redisToken) {
  console.error("❌ 环境变量 UPSTASH_REDIS_REST_URL 或 UPSTASH_REDIS_REST_TOKEN 不存在，请检查 .env.local");
  process.exit(1);
}

const redis = new Redis({
  url: redisUrl,
  token: redisToken
});

const minuteRateLimit = new Ratelimit({
  redis: redis,
  limiter: Ratelimit.slidingWindow(rateLimitConfig.minuteLimit, '1 m'),
  analytics: false,
  prefix: '@upstash/ratelimit/minute'
});

async function runTests() {
  console.log("==========================================");
  console.log("1. 测试 Redis 连接状态 (死活检测)...");
  try {
    const testKey = 'test_connection_' + Date.now();
    await redis.set(testKey, 'Connection Successful!', { ex: 10 }); // 10秒后自动过期
    const value = await redis.get(testKey);
    if (value === 'Connection Successful!') {
      console.log("✅ 成功! Redis 读写正常。");
    } else {
      console.log("❌ 失败! 读出来的值不对。");
    }
  } catch (error) {
    console.error("❌ 失败! 无法连接到 Redis:", error);
    process.exit(1);
  }

  console.log("\n==========================================");
  console.log(`2. 测试限流器 (每分钟限制 ${rateLimitConfig.minuteLimit} 次)...`);
  
  const testUserId = "test-user-" + Date.now();
  const testCount = rateLimitConfig.minuteLimit + 2; 
  
  console.log(`模拟用户 [${testUserId}] 连续发送 ${testCount} 次请求:`);

  for (let i = 1; i <= testCount; i++) {
    const { success, limit, remaining, reset } = await minuteRateLimit.limit(testUserId);
    
    if (success) {
      console.log(`[请求 ${i}] ✅ 放行! (剩余额度: ${remaining}/${limit})`);
    } else {
      const resetTime = new Date(reset).toLocaleTimeString();
      console.log(`[请求 ${i}] 🚫 拦截! 触发限流，请在 ${resetTime} 之后重试。`);
    }
  }
  
  console.log("==========================================");
  console.log("测试完毕！");
}

runTests();

import { Redis } from '@upstash/redis';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || 'https://eternal-antelope-106176.upstash.io',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || 'gQAAAAAAAZ7AAAIgcDE5YTlkNmFhMzQ3MzI0YjZkOGE0NDRmNWEzMTc4M2RiMw'
});

async function testConnection() {
  console.log("Testing Upstash Redis Connection...");
  try {
    await redis.set('test_connection', 'Connection Successful!');
    const value = await redis.get('test_connection');
    console.log("✅ SUCCESS! Read from Redis:", value);
  } catch (error) {
    console.error("❌ FAILED! Could not connect to Redis:", error);
  }
}

testConnection();

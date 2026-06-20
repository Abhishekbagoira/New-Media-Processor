import IORedis from "ioredis";
import dotenv from "dotenv";
dotenv.config();

// BullMQ requires this exact setting on the connection it's given
export const redisConnection = new IORedis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null,
});

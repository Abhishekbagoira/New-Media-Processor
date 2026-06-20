import IORedis from "ioredis";
import logger from "../utils/logger.js";

// maxRetriesPerRequest: null is mandatory for BullMQ — do not remove
export const createRedisConnection = () => {
  const connection = new IORedis(process.env.REDIS_URL, {
    maxRetriesPerRequest: null,
  });

  connection.on("connect", () => logger.info("[redis] connected"));
  connection.on("error", (err) => logger.error("[redis]", err.message));

  return connection;
};

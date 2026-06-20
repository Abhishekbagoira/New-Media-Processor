import "dotenv/config";
import { Worker } from "bullmq";
import { createRedisConnection } from "./config/redis.js";
import { QUEUE_NAME } from "./config/queue.js";
import { processJob } from "./pipeline/processJob.js";
import logger from "./utils/logger.js";

const redisConnection = createRedisConnection();

const worker = new Worker(QUEUE_NAME, processJob, {
  connection: redisConnection,
  concurrency: 1,
});

worker.on("active", (job) =>
  logger.info(`[worker] active   jobId=${job.data.jobId}`),
);
worker.on("completed", (job) =>
  logger.info(`[worker] done     jobId=${job.data.jobId}`),
);
worker.on("failed", (job, err) =>
  logger.error(
    `[worker] failed   jobId=${job?.data?.jobId} attempt=${job?.attemptsMade} err=${err.message}`,
  ),
);
worker.on("error", (err) => logger.error(`[worker] error:`, err.message));

logger.info(`[worker] listening on queue "${QUEUE_NAME}"`);

const shutdown = async (signal) => {
  logger.info(`[worker] ${signal} — shutting down`);
  await worker.close();
  await redisConnection.quit();
  process.exit(0);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

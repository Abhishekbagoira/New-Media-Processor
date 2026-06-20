import { Queue } from "bullmq";
import { redisConnection } from "./redis.js";

export const QUEUE_NAME = "image-processing";

export const imageQueue = new Queue(QUEUE_NAME, {
  connection: redisConnection,
});

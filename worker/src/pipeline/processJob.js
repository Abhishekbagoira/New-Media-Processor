import logger from "../utils/logger.js";
import { assertFileExists } from "../storage/fileStorage.js";
import { runCaptioning } from "./caption.js";
import { runLabelDetection } from "./labels.js";
import { runSafeSearch } from "./safety.js";
import pool from "../config/db.js";

const updateJob = async (jobId, fields) => {
  const keys = Object.keys(fields);
  const values = Object.values(fields);
  const set = keys.map((k, i) => `${k} = $${i + 2}`).join(", ");
  await pool.query(`UPDATE jobs SET ${set}, updated_at = NOW() WHERE id = $1`, [
    jobId,
    ...values,
  ]);
};

const createNotification = async (userId, jobId, flaggedCategories) => {
  const categories = flaggedCategories.join(", ");
  const message = `Your upload was flagged for: ${categories}. Please review the content policy.`;
  await pool.query(
    `INSERT INTO notifications (user_id, job_id, message, type)
     VALUES ($1, $2, $3, 'flagged_content')`,
    [userId, jobId, message],
  );
  logger.info(
    `[notification] created for jobId=${jobId} categories=${categories}`,
  );
};

export const processJob = async (bullJob) => {
  const { jobId } = bullJob.data;

  logger.info(`[processJob] received jobId=${jobId}`);

  const result = await pool.query(`SELECT * FROM jobs WHERE id = $1`, [jobId]);

  const dbJob = result.rows[0];

  if (!dbJob) {
    throw new Error(`Job not found: ${jobId}`);
  }

  const filePath = dbJob.file_path;
  const userId = dbJob.user_id;

  logger.info(`[processJob] filePath=${filePath}`);

  // pending → processing
  await updateJob(jobId, { status: "processing" });
  logger.info("[processJob] status → processing");

  try {
    await assertFileExists(filePath);

    const caption = await runCaptioning(filePath);
    const labels = await runLabelDetection(filePath);
    const { flagged, flaggedCategories, details } =
      await runSafeSearch(filePath);

    // processing → completed
    await updateJob(jobId, {
      status: "completed",
      caption,
      labels: JSON.stringify(labels),
      safety_result: JSON.stringify(details),
      flagged,
      flagged_categories: JSON.stringify(flaggedCategories),
    });

    // Create notification only if flagged
    if (flagged && flaggedCategories.length > 0) {
      await createNotification(userId, jobId, flaggedCategories);
    }

    logger.info(`[processJob] status → completed ✓ flagged=${flagged}`);
  } catch (err) {
    const message = err?.message ?? "Unknown error";

    await pool.query(
      `UPDATE jobs
       SET status        = 'failed',
           error_message = $2,
           retry_count   = retry_count + 1,
           updated_at    = NOW()
       WHERE id = $1`,
      [jobId, message],
    );

    logger.error(`[processJob] status → failed: ${message}`);
    throw err;
  }
};

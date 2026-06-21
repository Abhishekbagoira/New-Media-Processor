import logger from "../utils/logger.js";
import { runCaptioning } from "./caption.js";
import { runLabelDetection } from "./labels.js";
import { runSafeSearch } from "./safety.js";
import pool from "../config/db.js";
import https from "https";
import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// ── resolve public/temp folder ───────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Goes up from worker/src/jobs/ → worker/ → project root → public/temp
const TEMP_DIR = path.resolve(__dirname, "../../../public/temp");

// Make sure folder exists on startup
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
  logger.info(`[processJob] created temp dir: ${TEMP_DIR}`);
}

// ── helpers ──────────────────────────────────────────────────────────────────

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

const downloadToTemp = (url, jobId) => {
  return new Promise((resolve, reject) => {
    const ext = path.extname(new URL(url).pathname) || ".jpg";
    const fileName = `job-${jobId}${ext}`;
    const destPath = path.join(TEMP_DIR, fileName); // ← public/temp/job-abc.jpg

    logger.info(`[processJob] downloading to ${destPath}`);

    const file = fs.createWriteStream(destPath);
    const protocol = url.startsWith("https") ? https : http;

    protocol
      .get(url, (res) => {
        if (res.statusCode !== 200) {
          file.close();
          fs.unlink(destPath, () => {});
          return reject(
            new Error(`Failed to download image: HTTP ${res.statusCode}`),
          );
        }
        res.pipe(file);
        file.on("finish", () => {
          file.close();
          logger.info(`[processJob] download complete → ${destPath}`);
          resolve(destPath);
        });
      })
      .on("error", (err) => {
        file.close();
        fs.unlink(destPath, () => {});
        reject(err);
      });
  });
};

const cleanupTemp = (filePath) => {
  if (!filePath) return;
  fs.unlink(filePath, (err) => {
    if (!err) logger.info(`[processJob] cleaned up ${filePath}`);
    else logger.warn(`[processJob] cleanup failed: ${err.message}`);
  });
};

// ── main ─────────────────────────────────────────────────────────────────────

export const processJob = async (bullJob) => {
  const { jobId } = bullJob.data;
  logger.info(`[processJob] received jobId=${jobId}`);

  const result = await pool.query(`SELECT * FROM jobs WHERE id = $1`, [jobId]);
  const dbJob = result.rows[0];

  if (!dbJob) throw new Error(`Job not found: ${jobId}`);

  const filePath = dbJob.file_path;
  const userId = dbJob.user_id;

  logger.info(`[processJob] filePath=${filePath}`);

  await updateJob(jobId, { status: "processing" });
  logger.info("[processJob] status → processing");

  // download remote URL to public/temp first
  const isRemote =
    filePath.startsWith("http://") || filePath.startsWith("https://");
  let localPath = filePath;
  let tmpPath = null;

  if (isRemote) {
    tmpPath = await downloadToTemp(filePath, jobId);
    localPath = tmpPath;
    logger.info(`[processJob] localPath=${localPath}`);
  }

  try {
    const caption = await runCaptioning(localPath);
    const labels = await runLabelDetection(localPath);
    const { flagged, flaggedCategories, details } =
      await runSafeSearch(localPath);

    await updateJob(jobId, {
      status: "completed",
      caption,
      labels: JSON.stringify(labels),
      safety_result: JSON.stringify(details),
      flagged,
      flagged_categories: JSON.stringify(flaggedCategories),
    });

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
  } finally {
    // always delete temp file — success or failure
    cleanupTemp(tmpPath);
  }
};

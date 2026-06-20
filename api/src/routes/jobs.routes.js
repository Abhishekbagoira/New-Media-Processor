import express from "express";
import multer from "multer";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { pool } from "../config/db.js";
import { imageQueue } from "../config/queue.js";

const router = express.Router();

// ── Multer config ─────────────────────────────────────────────────────────────

const storage = multer.diskStorage({
  destination: "/app/uploads",
  filename: (req, file, cb) => {
    cb(
      null,
      `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`,
    );
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = ["image/jpeg", "image/png", "image/webp"];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Invalid file type. Only JPG, PNG, WEBP allowed."), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

// ── POST /api/jobs/upload ─────────────────────────────────────────────────────
/**
 * @swagger
 * /api/jobs/upload:
 *   post:
 *     summary: Upload image for processing
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Job created
 */
router.post("/upload", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No image file provided" });
    }

    const jobId = uuidv4();
    const filePath = `/app/uploads/${req.file.filename}`;

    await pool.query(
      `INSERT INTO jobs (id, user_id, file_path, original_filename, status)
       VALUES ($1, $2, $3, $4, 'pending')`,
      [jobId, req.user.id, filePath, req.file.originalname],
    );

    await imageQueue.add("process", { jobId, filePath });

    return res.status(201).json({ jobId, status: "pending" });
  } catch (err) {
    console.error("[upload] error:", err.message);
    return res.status(500).json({ error: "Upload failed" });
  }
});

// ── GET /api/jobs ─────────────────────────────────────────────────────────────
/**
 * @swagger
 * /api/jobs:
 *   get:
 *     summary: Get all jobs
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of jobs
 */
router.get("/", async (req, res) => {
  try {
    const { flagged } = req.query;
    let query = `SELECT id, status, original_filename, caption, labels, flagged,
       error_message, retry_count, created_at, updated_at
       FROM jobs
       WHERE user_id = $1`;

    const params = [req.user.id];

    if (flagged === "true") {
        query += ` AND flagged = TRUE`;
    }

    query += ` ORDER BY created_at DESC`;

    const { rows } = await pool.query(query, params);

    return res.json({ jobs: rows });
    } catch (err) {
        console.error("[jobs] list error:", err.message);
        return res.status(500).json({ error: "Failed to fetch jobs" });
    }
});

// ── GET /api/jobs/:id ─────────────────────────────────────────────────────────
/**
 * @swagger
 * /api/jobs/{id}:
 *   get:
 *     summary: Get single job
 *     security:
 *       - bearerAuth: []
 */
router.get("/:id", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, status, original_filename, file_path, caption, labels,
              safety_result, flagged, error_message, retry_count,
              created_at, updated_at
       FROM jobs
       WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.id],
    );

    if (!rows[0]) {
      return res.status(404).json({ error: "Job not found" });
    }

    return res.json({ job: rows[0] });
  } catch (err) {
    console.error("[jobs] detail error:", err.message);
    return res.status(500).json({ error: "Failed to fetch job" });
  }
});

// ── POST /api/jobs/:id/retry ──────────────────────────────────────────────────
/**
 * @swagger
 * /api/jobs/{id}/retry:
 *   post:
 *     summary: Retry failed job
 *     security:
 *       - bearerAuth: []
 */
router.post("/:id/retry", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM jobs WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.id],
    );

    const job = rows[0];

    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }

    if (job.status !== "failed") {
      return res.status(400).json({
        error: `Job cannot be retried. Current status: ${job.status}`,
      });
    }

    await pool.query(
      `UPDATE jobs
       SET status = 'pending', error_message = NULL, updated_at = NOW()
       WHERE id = $1`,
      [job.id],
    );

    await imageQueue.add("process", {
      jobId: job.id,
      filePath: job.file_path,
    });

    return res.json({ message: "Job queued for retry", jobId: job.id });
  } catch (err) {
    console.error("[retry] error:", err.message);
    return res.status(500).json({ error: "Retry failed" });
  }
});

export default router;

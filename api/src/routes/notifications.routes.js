import express from "express";
import { pool } from "../config/db.js";

const router = express.Router();

// ── GET /api/notifications ────────────────────────────────────────────────────
// Returns all notifications for the logged-in user, newest first

router.get("/", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, job_id, message, type, read, created_at
       FROM notifications
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [req.user.id],
    );
    return res.json({ notifications: rows });
  } catch (err) {
    console.error("[notifications] list error:", err.message);
    return res.status(500).json({ error: "Failed to fetch notifications" });
  }
});

// ── GET /api/notifications/unread-count ───────────────────────────────────────
// Returns count of unread notifications

router.get("/unread-count", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT COUNT(*) as count
       FROM notifications
       WHERE user_id = $1 AND read = FALSE`,
      [req.user.id],
    );
    return res.json({ count: parseInt(rows[0].count) });
  } catch (err) {
    console.error("[notifications] count error:", err.message);
    return res.status(500).json({ error: "Failed to fetch count" });
  }
});

// ── PATCH /api/notifications/:id/read ────────────────────────────────────────
// Mark a single notification as read

router.patch("/:id/read", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE notifications
       SET read = TRUE
       WHERE id = $1 AND user_id = $2
       RETURNING id, read`,
      [req.params.id, req.user.id],
    );

    if (!rows[0]) {
      return res.status(404).json({ error: "Notification not found" });
    }

    return res.json({ message: "Notification marked as read", id: rows[0].id });
  } catch (err) {
    console.error("[notifications] read error:", err.message);
    return res.status(500).json({ error: "Failed to update notification" });
  }
});

// ── PATCH /api/notifications/read-all ────────────────────────────────────────
// Mark all notifications as read

router.patch("/read-all", async (req, res) => {
  try {
    await pool.query(
      `UPDATE notifications SET read = TRUE WHERE user_id = $1`,
      [req.user.id],
    );
    return res.json({ message: "All notifications marked as read" });
  } catch (err) {
    console.error("[notifications] read-all error:", err.message);
    return res.status(500).json({ error: "Failed to update notifications" });
  }
});

export default router;

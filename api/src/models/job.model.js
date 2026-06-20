import { pool } from "../config/db.js";

export async function createJob({
  userId,
  originalFilename,
  filePath,
  mimeType,
  fileSize,
}) {
  const result = await pool.query(
    `INSERT INTO jobs (user_id, original_filename, file_path, mime_type, file_size, status)
     VALUES ($1, $2, $3, $4, $5, 'pending')
     RETURNING *`,
    [userId, originalFilename, filePath, mimeType, fileSize],
  );
  return result.rows[0];
}

export async function findJobById(id) {
  const result = await pool.query("SELECT * FROM jobs WHERE id = $1", [id]);
  return result.rows[0] || null;
}

export async function findJobsByUser(userId) {
  const result = await pool.query(
    "SELECT * FROM jobs WHERE user_id = $1 ORDER BY created_at DESC",
    [userId],
  );
  return result.rows;
}

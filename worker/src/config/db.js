import pg from "pg";
import logger from "../utils/logger.js";

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.on("connect", () => logger.info("[db] pool connected"));
pool.on("error", (err) => logger.error("[db] pool error", err.message));

export default pool;

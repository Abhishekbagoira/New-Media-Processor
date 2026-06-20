import dotenv from "dotenv";
dotenv.config();

import app from "./app.js";
import { runMigrations } from "./db/migrate.js";

const PORT = process.env.PORT || 4000;

async function start() {
  try {
    console.log("[server] running migrations...");
    await runMigrations();
    console.log("[server] migrations complete");

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[server] api listening on port ${PORT}`);
  });
  } catch (err) {
    console.error("[server] failed to start:", err);
    process.exit(1);
  }
}

start();

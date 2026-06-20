import fs from "fs/promises";
import path from "path";

// Shared volume mount path — same path the api service writes uploads to
const UPLOADS_DIR = "/app/uploads";

/**
 * Returns the absolute path for a given filename.
 */
export const getFilePath = (filePath) => {
  // If already absolute, use as-is. If just a filename, join with UPLOADS_DIR.
  if (path.isAbsolute(filePath)) {
    return filePath;
  }
  return path.join(UPLOADS_DIR, filePath);
};

/**
 * Confirms the file exists on the shared volume.
 * Throws if missing — caught by processJob and marks job as failed.
 */
export const assertFileExists = async (filename) => {
  const filePath = getFilePath(filename);
  await fs.access(filePath);
  return filePath;
};

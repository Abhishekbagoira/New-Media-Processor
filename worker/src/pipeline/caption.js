import logger from "../utils/logger.js";
import fs from "fs";

const ML_URL = process.env.ML_SERVICE_URL ?? "http://ml:5000";

export const runCaptioning = async (localPath) => {
  logger.info("[caption] starting");

  // localPath is always a local file — downloaded by processJob
  const blob = new Blob([fs.readFileSync(localPath)]);
  const formData = new FormData();
  formData.append("image", blob, "image.jpg");

  const response = await fetch(`${ML_URL}/caption`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`ML caption error ${response.status}: ${text}`);
  }

  const data = await response.json();
  logger.info(`[caption] result: "${data.caption}"`);
  return data.caption;
};

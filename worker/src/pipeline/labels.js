import logger from "../utils/logger.js";
import fs from "fs";

const ML_URL = process.env.ML_SERVICE_URL ?? "http://ml:5000";

export const runLabelDetection = async (localPath) => {
  logger.info("[labels] starting");

  // localPath is always a local file — downloaded by processJob
  const blob = new Blob([fs.readFileSync(localPath)]);
  const formData = new FormData();
  formData.append("image", blob, "image.jpg");

  const response = await fetch(`${ML_URL}/labels`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`ML labels error ${response.status}: ${text}`);
  }

  const data = await response.json();
  logger.info(`[labels] result: ${JSON.stringify(data.labels)}`);
  return data.labels;
};

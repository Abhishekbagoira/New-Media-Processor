import logger from "../utils/logger.js";
import fs from "fs";

const ML_URL = process.env.ML_SERVICE_URL ?? "http://ml:5000";

export const runLabelDetection = async (filePath) => {
  logger.info("[labels] starting");

  const formData = new FormData();
  const blob = new Blob([fs.readFileSync(filePath)]);
  formData.append("image", blob, "image.png");

  const response = await fetch(`${ML_URL}/labels`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`ML labels error ${response.status}: ${text}`);
  }

  const data = await response.json();
  logger.info(`[labels] result: ${data.labels.join(", ")}`);
  return data.labels;
};

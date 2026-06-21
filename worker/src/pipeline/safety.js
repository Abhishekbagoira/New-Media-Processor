import logger from "../utils/logger.js";
import fs from "fs";

const ML_URL = process.env.ML_SERVICE_URL ?? "http://ml:5000";

const UNSAFE_LIKELIHOODS = ["POSSIBLE", "LIKELY", "VERY_LIKELY"];

export const runSafeSearch = async (localPath) => {
  logger.info("[safety] starting");

  // localPath is always a local file — downloaded by processJob
  const blob = new Blob([fs.readFileSync(localPath)]);
  const formData = new FormData();
  formData.append("image", blob, "image.jpg");

  const response = await fetch(`${ML_URL}/safety`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`ML safety error ${response.status}: ${text}`);
  }

  const data = await response.json();
  const details = data.details;

  const flaggedCategories = Object.entries(details)
    .filter(([, likelihood]) => UNSAFE_LIKELIHOODS.includes(likelihood))
    .map(([category]) => category);

  const flagged = flaggedCategories.length > 0;

  logger.info(
    `[safety] flagged=${flagged} categories=${flaggedCategories.join(", ") || "none"}`,
  );

  return { flagged, flaggedCategories, details };
};

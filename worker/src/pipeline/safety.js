import logger from "../utils/logger.js";
import fs from "fs";

const ML_URL = process.env.ML_SERVICE_URL ?? "http://ml:5000";

// Likelihoods that count as unsafe — matches Google Vision SafeSearch spec
const UNSAFE_LIKELIHOODS = [ "LIKELY", "VERY_LIKELY"];

export const runSafeSearch = async (filePath) => {
  logger.info("[safety] starting");

  const formData = new FormData();
  const blob = new Blob([fs.readFileSync(filePath)]);
  formData.append("image", blob, "image.png");

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

  // Find which specific categories are unsafe
  const flaggedCategories = Object.entries(details)
    .filter(([, likelihood]) => UNSAFE_LIKELIHOODS.includes(likelihood))
    .map(([category]) => category);

  const flagged = flaggedCategories.length > 0;

  logger.info(
    `[safety] flagged=${flagged} categories=${flaggedCategories.join(", ") || "none"}`,
  );

  return {
    flagged,
    flaggedCategories,
    details,
  };
};

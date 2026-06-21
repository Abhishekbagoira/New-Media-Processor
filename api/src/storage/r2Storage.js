import { PutObjectCommand } from "@aws-sdk/client-s3";
import r2 from "../config/r2.js";

export async function uploadToR2(buffer, key, mimeType) {
  try {
    await r2.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
      }),
    );

    return key;
  } catch (err) {
    console.error("R2 Upload Error:", {
      name: err.name,
      code: err.code,
      message: err.message,
      metadata: err.$metadata,
    });

    throw err;
  }
}

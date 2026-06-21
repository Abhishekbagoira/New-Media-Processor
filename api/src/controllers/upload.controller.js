import { createJob } from "../models/job.model.js";
import { imageQueue } from "../config/queue.js";
import { uploadOnCloudinary } from "../config/cloudinary.js";

export async function uploadImage(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'No file provided. Use form field name "file".',
      });
    }

    const cloudinaryResponse = await uploadOnCloudinary(req.file.path);

    if (!cloudinaryResponse) {
      return res.status(500).json({
        error: "Failed to upload image to Cloudinary",
      });
    }

    const job = await createJob({
      userId: req.user.id,
      originalFilename: req.file.originalname,

      // Cloudinary URL
      filePath: cloudinaryResponse.secure_url,

      mimeType: req.file.mimetype,
      fileSize: req.file.size,
    });

    await imageQueue.add(
      "process-image",
      {
        jobId: job.id,
      },
      {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 5000,
        },
      },
    );

    return res.status(202).json({
      jobId: job.id,
      status: job.status,

      localFile: req.file.path,

      imageUrl: cloudinaryResponse.secure_url,

      message: "Job queued for processing",
    });
  } catch (err) {
    next(err);
  }
}

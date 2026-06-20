import { createJob } from "../models/job.model.js";
import { imageQueue } from "../config/queue.js";

export async function uploadImage(req, res, next) {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ error: 'No file provided. Use form field name "file".' });
    }

    const job = await createJob({
      userId: req.user.id,
      originalFilename: req.file.originalname,
      filePath: req.file.path,
      mimeType: req.file.mimetype,
      fileSize: req.file.size,
    });

    await imageQueue.add(
      "process-image",
      { jobId: job.id },
      { attempts: 3, backoff: { type: "exponential", delay: 5000 } },
    );

    // Returned immediately — caller does not wait for processing.
    res.status(202).json({
      jobId: job.id,
      status: job.status,
      message: "Job queued for processing",
    });
  } catch (err) {
    next(err);
  }
}

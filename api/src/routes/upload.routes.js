import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { uploadSingleImage } from "../middleware/upload.js";
import { uploadImage } from "../controllers/upload.controller.js";

const router = Router();

router.post("/", requireAuth, uploadSingleImage, uploadImage);

export default router;

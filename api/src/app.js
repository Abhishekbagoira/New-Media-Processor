import express from "express";
import cors from "cors";

import authRoutes from "./routes/auth.routes.js";
import uploadRoutes from "./routes/upload.routes.js";
import jobsRoutes from "./routes/jobs.routes.js";
import { requireAuth } from "./middleware/auth.js";
import swaggerUi from "swagger-ui-express";
import swaggerSpec from "./docs/swagger.js";
import notificationsRoutes from "./routes/notifications.routes.js";

import { errorHandler } from "./middleware/errorHandler.js";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => res.json({ status: "ok" }));

app.use("/api/auth", authRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/jobs", requireAuth, jobsRoutes);
app.use("/api/notifications", requireAuth, notificationsRoutes);

app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use((req, res) => {
  res.status(404).json({ error: "route not found" });
});

app.use(errorHandler);

export default app;

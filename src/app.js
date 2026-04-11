import express from "express";
import path from "node:path";
import authRoutes from "./routes/authRoutes.js";
import noteRoutes from "./routes/noteRoutes.js";
import uploadRoutes from "./routes/uploadRoutes.js";
import webhookRoutes from "./routes/webhookRoutes.js";
import knowledgeRoutes from "./routes/knowledgeRoutes.js";
import { attachUser } from "./middleware/authMiddleware.js";

export function createApp() {
  const app = express();
  const publicDir = path.resolve(process.cwd(), "src/public");

  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use(attachUser);
  app.use(express.static(publicDir));

  app.get("/health", (req, res) => {
    res.json({
      ok: true,
      service: "meeting-notes-agent"
    });
  });

  app.use("/api/auth", authRoutes);
  app.use("/api/notes", noteRoutes);
  app.use("/api/uploads", uploadRoutes);
  app.use("/api/webhooks", webhookRoutes);
  app.use("/api/knowledge", knowledgeRoutes);

  app.get("/", (req, res) => {
    res.sendFile(path.join(publicDir, "index.html"));
  });

  app.use((error, req, res, next) => {
    console.error(error);

    if (error?.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({
        error: "File is too large. Maximum upload size is 150 MB."
      });
    }

    res.status(error.status || 500).json({
      error: error.message || "Internal server error",
      details: error.payload || error.outputText || undefined
    });
  });

  return app;
}

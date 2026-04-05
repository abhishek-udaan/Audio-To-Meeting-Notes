import express from "express";
import path from "node:path";
import uploadRoutes from "./routes/uploadRoutes.js";
import webhookRoutes from "./routes/webhookRoutes.js";
import { storageRoot } from "./config/paths.js";

export function createApp() {
  const app = express();
  const publicDir = path.resolve(process.cwd(), "src/public");

  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use(express.static(publicDir));
  app.use("/files", express.static(storageRoot));

  app.get("/health", (req, res) => {
    res.json({
      ok: true,
      service: "meeting-notes-agent"
    });
  });

  app.use("/api/uploads", uploadRoutes);
  app.use("/api/webhooks", webhookRoutes);

  app.get("/", (req, res) => {
    res.sendFile(path.join(publicDir, "index.html"));
  });

  app.use((error, req, res, next) => {
    console.error(error);
    res.status(error.status || 500).json({
      error: error.message || "Internal server error",
      details: error.payload || error.outputText || undefined
    });
  });

  return app;
}

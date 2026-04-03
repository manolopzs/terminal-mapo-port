/**
 * Vercel Serverless entry point.
 * Wraps the Express app for deployment on Vercel.
 */
import express, { type Request, Response, NextFunction } from "express";
import { createServer } from "http";
import path from "path";
import fs from "fs";
import { registerRoutes } from "../server/routes.ts";

const app = express();

app.use(
  express.json({
    verify: (req: any, _res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ extended: false }));

// Initialize routes once and cache
let initialized = false;
let initPromise: Promise<void> | null = null;

function initApp(): Promise<void> {
  if (initialized) return Promise.resolve();
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const httpServer = createServer(app);
    await registerRoutes(httpServer, app);

    app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      if (res.headersSent) return next(err);
      res.status(status).json({ message });
    });

    // Serve static client files
    const publicDir = path.resolve(process.cwd(), "dist", "public");
    if (fs.existsSync(publicDir)) {
      app.use(express.static(publicDir));
      app.use("/{*path}", (_req: Request, res: Response) => {
        res.sendFile(path.join(publicDir, "index.html"));
      });
    }

    initialized = true;
  })();

  return initPromise;
}

export default async function handler(req: Request, res: Response) {
  try {
    await initApp();
  } catch (err: any) {
    console.error("[api/index] initApp failed:", err?.message, err?.stack);
    res.status(500).json({ error: "Server initialization failed", detail: err?.message });
    return;
  }
  return app(req, res);
}

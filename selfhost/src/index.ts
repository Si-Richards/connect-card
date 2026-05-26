import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import path from "node:path";
import fs from "node:fs";
import { env } from "./env.js";
import { attachUser } from "./auth.js";
import { authRouter } from "./routes/auth.js";
import { employeesRouter } from "./routes/employees.js";
import { settingsRouter } from "./routes/settings.js";
import { uploadsRouter } from "./routes/uploads.js";
import { analyticsRouter } from "./routes/analytics.js";
import { publicRouter } from "./routes/public.js";

const app = express();
app.set("trust proxy", true);
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
app.use(
  cors({
    origin: env.APP_ORIGIN,
    credentials: true,
  }),
);
app.use(attachUser);

fs.mkdirSync(env.UPLOAD_DIR, { recursive: true });
app.use("/uploads", express.static(path.resolve(env.UPLOAD_DIR), { maxAge: "7d" }));

app.get("/api/public/healthcheck", (_req, res) => res.json({ ok: true }));

app.use("/api/auth", authRouter);
app.use("/api/employees", employeesRouter);
app.use("/api/settings", settingsRouter);
app.use("/api/uploads", uploadsRouter);
app.use("/api/analytics", analyticsRouter);
app.use("/api/public", publicRouter);

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  if (res.headersSent) return;
  res.status(500).json({ error: err?.message ?? "Internal error" });
});

app.listen(env.PORT, () => {
  console.log(`business-card API listening on :${env.PORT}`);
});

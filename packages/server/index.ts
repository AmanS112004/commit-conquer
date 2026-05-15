
import express, { type Response } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.join(__dirname, ".env") });

// ─── Env Validation ───────────────────────────────────────────────────────────
const REQUIRED_ENV_VARS = ["STRIPE_KEY", "DB_URL"];
const missingVars = REQUIRED_ENV_VARS.filter(v => !process.env[v]);

if (missingVars.length > 0) {
  console.error(`
  ❌ ERROR: Missing required environment variables:
     ${missingVars.join(", ")}

     The server cannot start without these. Please check your .env file.
  `);
  // Not exiting in dev mode to allow simulation
}

import { storeRouter }   from "./routers/store.router.ts";
import { adminRouter }   from "./routers/admin.router.ts";
import { paymentRouter } from "./routers/payment.router.ts";

const app  = express();
const PORT = parseInt(process.env.PORT ?? "4000", 10);
const MODE = process.env.SERVICE_MODE ?? "MONOLITH"; // MONOLITH, STOREFRONT, ADMIN, PAYMENTS

app.use(helmet());
app.use(cors({
  origin:      process.env.CORS_ORIGIN ?? "http://localhost:5173",
  credentials: true,
  methods:     ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Admin-Secret", "X-Cart-Id"],
}));
app.use(express.json({ limit: "2mb" }));
app.use(morgan("dev"));

// ─── Health Check ───────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({ status: "ok", mode: MODE, timestamp: new Date().toISOString() });
});

// ─── Service Mounting ───────────────────────────────────────────────────────

if (MODE === "MONOLITH" || MODE === "STOREFRONT") {
  console.log("[Server] Mounting Storefront API at /api/store");
  app.use("/api/store", storeRouter);
}

if (MODE === "MONOLITH" || MODE === "ADMIN") {
  console.log("[Server] Mounting Admin API at /api/admin");
  app.use("/api/admin", adminRouter);
}

if (MODE === "MONOLITH" || MODE === "PAYMENTS") {
  console.log("[Server] Mounting Payment API at /api/payment");
  app.use("/api/payment", paymentRouter);
}

// ─── Error Handling ─────────────────────────────────────────────────────────

app.use((_req, res) => {
  res.status(404).json({ error: { code: "NOT_FOUND", message: "Route not found in current service mode" } });
});

app.listen(PORT, () => {
  console.log(`
  ┌──────────────────────────────────────────┐
  │   commit&conquer API — ${MODE} MODE
  │                                          │
  │   Port: ${PORT}                                 │
  │   Health: http://localhost:${PORT}/health     │
  └──────────────────────────────────────────┘
  `);
});

export default app;
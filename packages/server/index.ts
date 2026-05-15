
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
=======
import "dotenv/config";
import { enforceEnv } from "./src/validateEnv";

// ─── Validate environment variables before anything else ──────────────────────
// Fails fast with a clear error if required vars are missing or malformed.
enforceEnv();


import { ProductService, ServiceError } from "../modules/products/product.service.ts";
import { AuthService }     from "../modules/auth/auth.service.ts";
import { CartService }     from "../modules/cart/cart.service.ts";
import { OrderService }    from "../modules/orders/order.service.ts";
import { PaymentService }  from "../modules/payments/payment.service.ts";
import { InventoryService } from "../modules/inventory/inventory.service.ts";
import { DiscountService } from "../modules/discounts/discount.service.ts";
import { ShippingService } from "../modules/shipping/shipping.service.ts";
import { eventBus, EVENT } from "../core/event-bus.ts";



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
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));



declare global {
  namespace Express {
    interface Request {
      customer?: ReturnType<typeof AuthService.validateToken>;
    }
  }
}

const authenticate: RequestHandler = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json(err("UNAUTHORIZED", "Missing or malformed Authorization header"));
    return;
  }
  try {
    req.customer = AuthService.validateToken(header.slice(7));
    next();
  } catch (e) {
    handleErr(e, res);
  }
};


const softAuthenticate: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    try {
      req.customer = AuthService.validateToken(header.slice(7));
    } catch {
      
    }
  }
  next();
};


const adminOnly: RequestHandler = (req, res, next) => {
  const secret = req.headers["x-admin-secret"];
  if (secret !== process.env.ADMIN_SECRET && process.env.NODE_ENV !== "development") {
    res.status(403).json(err("FORBIDDEN", "Admin access required"));
    return;
  }
  next();
};



function err(code: string, message: string) {
  return { error: { code, message } };
}

function handleErr(e: unknown, res: Response) {
  if (e instanceof ServiceError) {
    const status = STATUS_MAP[e.code] ?? 400;
    res.status(status).json(err(e.code, e.message));
    return;
  }
  console.error("[Server] Unexpected error:", e);
  res.status(500).json(err("INTERNAL_ERROR", "An unexpected error occurred"));
}

// Map ServiceError codes → HTTP status codes
const STATUS_MAP: Record<string, number> = {
  PRODUCT_NOT_FOUND:    404,
  VARIANT_NOT_FOUND:    404,
  CART_NOT_FOUND:       404,
  ORDER_NOT_FOUND:      404,
  TOO_MANY_REQUESTS:    429,
  CUSTOMER_NOT_FOUND:   404,
  ITEM_NOT_FOUND:       404,
  INVALID_CREDENTIALS:  401,
  INVALID_TOKEN:        401,
  TOKEN_EXPIRED:        401,
  UNAUTHORIZED:         401,
  FORBIDDEN:            403,
  INSUFFICIENT_STOCK:   409,
  EMAIL_EXISTS:         409,
  VALIDATION_ERROR:     422,
  WEAK_PASSWORD:        422,
  EMPTY_CART:           422,
  MISSING_EMAIL:        422,
  MISSING_ADDRESS:      422,
  UPDATE_FAILED:        500,
  DELETE_FAILED:        500,
  INTERNAL_ERROR:       500,
};



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
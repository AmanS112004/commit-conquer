
import express from "express";
import { ProductService }   from "../../modules/products/product.service.ts";
import { OrderService }     from "../../modules/orders/order.service.ts";
import { InventoryService } from "../../modules/inventory/inventory.service.ts";
import { DiscountService }  from "../../modules/discounts/discount.service.ts";
import { ShippingService }  from "../../modules/shipping/shipping.service.ts";

export const adminRouter = express.Router();

// Mock Admin Auth Middleware
adminRouter.use((req, res, next) => {
  const secret = req.headers["x-admin-secret"];
  if (secret !== "admin_dev_secret" && process.env.NODE_ENV !== "development") {
    return res.status(403).json({ error: { code: "FORBIDDEN", message: "Admin access required" } });
  }
  next();
});

const handleErr = (e: any, res: any) => {
  console.error("[AdminRouter] Error:", e);
  res.status(e.status || 400).json({ error: { code: e.code || "ERROR", message: e.message } });
};

// ─── Dashboard ──────────────────────────────────────────────────────────────

adminRouter.get("/dashboard/stats", (_req, res) => {
  try {
    const orders = OrderService.list({ limit: 1000 }).data;
    const totalRevenue = orders.reduce((s, o) => s + (o.payment_status === "captured" ? o.total : 0), 0);
    const orderCount = orders.length;
    res.json({ stats: { totalRevenue, orderCount, activeCarts: 12 } });
  } catch (e) { handleErr(e, res); }
});

// ─── Orders ─────────────────────────────────────────────────────────────────

adminRouter.get("/orders", (req, res) => {
  try {
    const result = OrderService.list({
      offset: parseInt(String(req.query.offset ?? "0"), 10),
      limit:  parseInt(String(req.query.limit  ?? "20"), 10),
      status: req.query.status as any,
      search: req.query.search as string,
    });
    res.json(result);
  } catch (e) { handleErr(e, res); }
});

adminRouter.post("/orders/:id/refund", async (req, res) => {
  try {
    const refund = await OrderService.refund({
      order_id: req.params.id,
      amount:   req.body.amount,
      reason:   req.body.reason,
    });
    res.json({ refund });
  } catch (e) { handleErr(e, res); }
});

// ─── Inventory ──────────────────────────────────────────────────────────────

adminRouter.get("/inventory", async (_req, res) => {
  try {
    const items = await InventoryService.listAll();
    res.json({ inventory: items });
  } catch (e) { handleErr(e, res); }
});

adminRouter.patch("/inventory/:variantId", async (req, res) => {
  try {
    const item = await InventoryService.setStock(req.params.variantId, req.body.stocked_quantity);
    res.json({ inventory: item });
  } catch (e) { handleErr(e, res); }
});

// ─── Products ───────────────────────────────────────────────────────────────

adminRouter.post("/products", async (req, res) => {
  try {
    const product = await ProductService.create(req.body);
    res.status(201).json({ product });
  } catch (e) { handleErr(e, res); }
});

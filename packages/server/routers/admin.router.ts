
import express from "express";
import { ProductService }   from "../../modules/products/product.service.ts";
import { OrderService }     from "../../modules/orders/order.service.ts";
import { InventoryService } from "../../modules/inventory/inventory.service.ts";
import { DiscountService }  from "../../modules/discounts/discount.service.ts";
import { ShippingService }  from "../../modules/shipping/shipping.service.ts";
import { AuthService }      from "../../modules/auth/auth.service.ts";

export const adminRouter = express.Router();

// ─── Admin Auth Middleware ──────────────────────────────────────────────────
const adminOnly = (req: any, res: any, next: any) => {
  const secret = req.headers["x-admin-secret"];
  if (secret !== "admin_dev_secret" && process.env.NODE_ENV !== "development") {
    return res.status(403).json({ error: { code: "FORBIDDEN", message: "Admin access required" } });
  }
  next();
};

adminRouter.use(adminOnly);

const handleErr = (e: any, res: any) => {
  console.error("[AdminRouter] Error:", e);
  const status = e.statusCode || e.status || 400;
  res.status(status).json({ 
    success: false,
    error: e.message || "Internal Server Error",
    code: e.code || "ERROR"
  });
};

// ─── Dashboard & Stats ──────────────────────────────────────────────────────

adminRouter.get("/stats", (_req, res) => {
  try {
    const products = ProductService.stats();
    const orders   = OrderService.stats();
    res.json({ products, orders });
  } catch (e) { handleErr(e, res); }
});

// ─── Products ───────────────────────────────────────────────────────────────

adminRouter.get("/products", (req, res) => {
  try {
    const result = ProductService.list({
      offset:   parseInt(String(req.query.offset ?? "0"), 10),
      limit:    parseInt(String(req.query.limit  ?? "12"), 10),
      status:   (req.query.status as any) ?? "all",
      category: req.query.category as string,
      search:   req.query.search   as string,
      sort:     req.query.sort     as any || "newest",
    });
    res.json(result);
  } catch (e) { handleErr(e, res); }
});

adminRouter.get("/products/:id", (req, res) => {
  try {
    res.json({ product: ProductService.getById(req.params.id) });
  } catch (e) { handleErr(e, res); }
});

adminRouter.post("/products", async (req, res) => {
  try {
    const product = await ProductService.create(req.body);
    res.status(201).json({ product });
  } catch (e) { handleErr(e, res); }
});

adminRouter.patch("/products/:id", async (req, res) => {
  try {
    const product = await ProductService.update(req.params.id, req.body);
    res.json({ product });
  } catch (e) { handleErr(e, res); }
});

adminRouter.delete("/products/:id", async (req, res) => {
  try {
    const result = await ProductService.delete(req.params.id);
    res.json(result);
  } catch (e) { handleErr(e, res); }
});

adminRouter.delete("/products", async (req, res) => {
  try {
    const result = await ProductService.bulkDelete(req.body.ids);
    res.json(result);
  } catch (e) { handleErr(e, res); }
});

adminRouter.post("/products/:id/publish", async (req, res) => {
  try {
    const product = await ProductService.publish(req.params.id);
    res.json({ product });
  } catch (e) { handleErr(e, res); }
});

adminRouter.post("/products/:id/unpublish", async (req, res) => {
  try {
    const product = await ProductService.unpublish(req.params.id);
    res.json({ product });
  } catch (e) { handleErr(e, res); }
});

adminRouter.patch("/products/:id/inventory", async (req, res) => {
  try {
    const { variant_id, delta } = req.body;
    await ProductService.adjustInventory(req.params.id, variant_id, delta);
    res.json({ success: true });
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
      sort:   req.query.sort   as any || "newest",
    });
    res.json(result);
  } catch (e) { handleErr(e, res); }
});

adminRouter.get("/orders/:id", (req, res) => {
  try {
    res.json({ order: OrderService.getById(req.params.id) });
  } catch (e) { handleErr(e, res); }
});

adminRouter.post("/orders/:id/fulfill", async (req, res) => {
  try {
    const order = await OrderService.fulfill(req.params.id);
    res.json({ order });
  } catch (e) { handleErr(e, res); }
});

adminRouter.post("/orders/:id/cancel", async (req, res) => {
  try {
    const order = await OrderService.cancel(req.params.id);
    res.json({ order });
  } catch (e) { handleErr(e, res); }
});

adminRouter.post("/orders/:id/refund", async (req, res) => {
  try {
    const order = await OrderService.refund({
      order_id: req.params.id,
      amount:   req.body.amount,
      reason:   req.body.reason,
    });
    res.json({ order });
  } catch (e) { handleErr(e, res); }
});

// ─── Customers ──────────────────────────────────────────────────────────────

adminRouter.get("/customers/:id", (req, res) => {
  try {
    res.json({ customer: AuthService.getById(req.params.id) });
  } catch (e) { handleErr(e, res); }
});

// ─── Discounts ──────────────────────────────────────────────────────────────

adminRouter.get("/discounts", async (_req, res) => {
  try {
    const result = await DiscountService.list();
    res.json({ discounts: result });
  } catch (e) { handleErr(e, res); }
});

adminRouter.post("/discounts", async (req, res) => {
  try {
    const discount = await DiscountService.create(req.body);
    res.status(201).json({ discount });
  } catch (e) { handleErr(e, res); }
});

adminRouter.delete("/discounts/:id", async (req, res) => {
  try {
    await DiscountService.delete(req.params.id);
    res.json({ deleted: req.params.id });
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
    const item = await InventoryService.setStock(
      req.params.variantId,
      req.body.stocked_quantity,
    );
    res.json({ inventory: item });
  } catch (e) { handleErr(e, res); }
});

// ─── Shipping ───────────────────────────────────────────────────────────────

adminRouter.get("/shipping-options", async (_req, res) => {
  try {
    const options = await ShippingService.listOptions();
    res.json({ shipping_options: options });
  } catch (e) { handleErr(e, res); }
});

adminRouter.post("/shipping-options", async (req, res) => {
  try {
    const option = await ShippingService.createOption(req.body);
    res.status(201).json({ shipping_option: option });
  } catch (e) { handleErr(e, res); }
});

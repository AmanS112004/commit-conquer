
import express from "express";
import { ProductService }  from "../../modules/products/product.service.ts";
import { CartService }     from "../../modules/cart/cart.service.ts";
import { OrderService }    from "../../modules/orders/order.service.ts";
import { AuthService }     from "../../modules/auth/auth.service.ts";
import { PaymentService }  from "../../modules/payments/payment.service.ts";
import { ShippingService } from "../../modules/shipping/shipping.service.ts";
import { InventoryService } from "../../modules/inventory/inventory.service.ts";
import { authenticate }    from "../src/middleware/authenticate.ts";

export const storeRouter = express.Router();

const softAuthenticate = (req: any, _res: any, next: any) => {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    try {
      req.customer = AuthService.validateToken(header.slice(7));
    } catch {}
  }
  next();
};

const handleErr = (e: any, res: any) => {
  console.error("[StoreRouter] Error:", e);
  const status = e.statusCode || e.status || 400;
  res.status(status).json({ 
    success: false,
    error: e.message || "Internal Server Error",
    code: e.code || "ERROR"
  });
};

// ─── Products ───────────────────────────────────────────────────────────────

storeRouter.get("/products", (req, res) => {
  try {
    const result = ProductService.list({
      offset:   parseInt(String(req.query.offset ?? "0"), 10),
      limit:    parseInt(String(req.query.limit  ?? "12"), 10),
      status:   (req.query.status as "published") ?? "published",
      category: req.query.category as string,
      search:   req.query.search   as string,
      sort:     req.query.sort     as "newest" | "price_asc" | "price_desc",
    });
    res.json(result);
  } catch (e) { handleErr(e, res); }
});

storeRouter.get("/products/:id", (req, res) => {
  try {
    const product = ProductService.getById(req.params.id);
    res.json({ product });
  } catch (e) { handleErr(e, res); }
});

storeRouter.get("/products/handle/:handle", (req, res) => {
  try {
    const product = ProductService.getByHandle(req.params.handle);
    res.json({ product });
  } catch (e) { handleErr(e, res); }
});

storeRouter.get("/categories", (_req, res) => {
  try {
    res.json({ categories: ProductService.categories() });
  } catch (e) { handleErr(e, res); }
});

// ─── Auth ───────────────────────────────────────────────────────────────────

storeRouter.post("/auth/register", async (req, res) => {
  try {
    const result = await AuthService.register(req.body);
    res.status(201).json(result);
  } catch (e) { handleErr(e, res); }
});

storeRouter.post("/auth/login", async (req, res) => {
  try {
    const result = await AuthService.login(req.body);
    res.json(result);
  } catch (e) { handleErr(e, res); }
});

storeRouter.post("/auth/logout", authenticate as any, async (req: any, res) => {
  try {
    const token = req.headers.authorization!.slice(7);
    await AuthService.logout(token);
    res.json({ success: true });
  } catch (e) { handleErr(e, res); }
});

storeRouter.get("/auth/me", authenticate as any, (req: any, res) => {
  res.json({ customer: req.customer || req.user });
});

storeRouter.patch("/auth/me", authenticate as any, async (req: any, res) => {
  try {
    const updated = await AuthService.updateProfile(req.customer?.id || req.user?.id, req.body);
    res.json({ customer: updated });
  } catch (e) { handleErr(e, res); }
});

storeRouter.post("/auth/reset-password/request", async (req, res) => {
  try {
    const result = await AuthService.requestPasswordReset(req.body.email);
    res.json(result);
  } catch (e) { handleErr(e, res); }
});

storeRouter.post("/auth/reset-password/confirm", async (req, res) => {
  try {
    await AuthService.confirmPasswordReset(req.body.reset_token, req.body.new_password);
    res.json({ success: true });
  } catch (e) { handleErr(e, res); }
});

storeRouter.post("/auth/google", async (req, res) => {
  try {
    const result = await AuthService.googleLogin(req.body.credential);
    res.json(result);
  } catch (e) { handleErr(e, res); }
});

// ─── Carts ──────────────────────────────────────────────────────────────────

storeRouter.post("/carts", softAuthenticate, async (req: any, res) => {
  try {
    const cart = await CartService.create(req.body.email ?? req.customer?.email);
    res.status(201).json({ cart });
  } catch (e) { handleErr(e, res); }
});

storeRouter.get("/carts/:id", (req, res) => {
  try {
    const cart = CartService.get(req.params.id);
    res.json({ cart });
  } catch (e) { handleErr(e, res); }
});

storeRouter.post("/carts/:id/items", async (req, res) => {
  try {
    const { product_id, variant_id, quantity = 1 } = req.body;
    const cart = await CartService.addItem(req.params.id, product_id, variant_id, quantity);
    res.json({ cart });
  } catch (e) { handleErr(e, res); }
});

storeRouter.delete("/carts/:id/items/:lineId", async (req, res) => {
  try {
    const cart = await CartService.removeItem(req.params.id, req.params.lineId);
    res.json({ cart });
  } catch (e) { handleErr(e, res); }
});

storeRouter.patch("/carts/:id/items/:lineId", async (req, res) => {
  try {
    const cart = await CartService.updateQuantity(
      req.params.id,
      req.params.lineId,
      req.body.quantity,
    );
    res.json({ cart });
  } catch (e) { handleErr(e, res); }
});

storeRouter.post("/carts/:id/discount", async (req, res) => {
  try {
    const cart = await CartService.applyDiscount(req.params.id, req.body.code);
    res.json({ cart });
  } catch (e) { handleErr(e, res); }
});

storeRouter.delete("/carts/:id/discount", async (req, res) => {
  try {
    const cart = await CartService.removeDiscount(req.params.id);
    res.json({ cart });
  } catch (e) { handleErr(e, res); }
});

storeRouter.patch("/carts/:id/email", async (req, res) => {
  try {
    const cart = await CartService.setEmail(req.params.id, req.body.email);
    res.json({ cart });
  } catch (e) { handleErr(e, res); }
});

storeRouter.patch("/carts/:id/shipping-address", async (req, res) => {
  try {
    const cart = await CartService.setShippingAddress(req.params.id, req.body);
    res.json({ cart });
  } catch (e) { handleErr(e, res); }
});

storeRouter.patch("/carts/:id/billing-address", async (req, res) => {
  try {
    const cart = await CartService.setBillingAddress(req.params.id, req.body);
    res.json({ cart });
  } catch (e) { handleErr(e, res); }
});

storeRouter.get("/carts/:id/summary", (req, res) => {
  try {
    const summary = CartService.summary(req.params.id);
    res.json(summary);
  } catch (e) { handleErr(e, res); }
});

// ─── Shipping & Orders ──────────────────────────────────────────────────────

storeRouter.get("/shipping-options", async (_req, res) => {
  try {
    const options = await ShippingService.listOptions();
    res.json({ shipping_options: options });
  } catch (e) { handleErr(e, res); }
});

storeRouter.post("/orders", softAuthenticate, async (req: any, res) => {
  try {
    const order = await OrderService.place(req.body);
    res.status(201).json({ order });
  } catch (e) { handleErr(e, res); }
});

storeRouter.get("/orders/:id", authenticate as any, (req: any, res) => {
  try {
    const order = OrderService.getById(req.params.id);
    if (order.customer_id && order.customer_id !== (req.customer?.id || req.user?.id)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    res.json({ order });
  } catch (e) { handleErr(e, res); }
});

storeRouter.get("/customers/me/orders", authenticate as any, (req: any, res) => {
  try {
    const result = OrderService.list({ customer_id: req.customer?.id || req.user?.id });
    res.json(result);
  } catch (e) { handleErr(e, res); }
});

// ─── Payments ───────────────────────────────────────────────────────────────

storeRouter.post("/payment/initiate", async (req, res) => {
  try {
    const session = await PaymentService.initiate(req.body);
    res.status(201).json({ payment_session: session });
  } catch (e) { handleErr(e, res); }
});

storeRouter.post("/payment/capture", async (req, res) => {
  try {
    const session = await PaymentService.capture(req.body);
    res.json({ payment_session: session });
  } catch (e) { handleErr(e, res); }
});

// ─── Inventory ──────────────────────────────────────────────────────────────

storeRouter.get("/inventory/:variantId", (req, res) => {
  try {
    const item = InventoryService.getByVariant(req.params.variantId);
    res.json({ inventory: item });
  } catch (e) { handleErr(e, res); }
});


import express from "express";
import { ProductService } from "../../modules/products/product.service.ts";
import { CartService }    from "../../modules/cart/cart.service.ts";
import { OrderService }   from "../../modules/orders/order.service.ts";
import { AuthService }    from "../../modules/auth/auth.service.ts";
import { InventoryService } from "../../modules/inventory/inventory.service.ts";

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
  res.status(e.status || 400).json({ error: { code: e.code || "ERROR", message: e.message } });
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

// ─── Carts ──────────────────────────────────────────────────────────────────

storeRouter.post("/carts", softAuthenticate, async (req, res) => {
  try {
    const cart = await CartService.create(req.customer?.id);
    res.status(201).json({ cart });
  } catch (e) { handleErr(e, res); }
});

storeRouter.get("/carts/:id", (req, res) => {
  try {
    const cart = CartService.get(req.params.id);
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

storeRouter.get("/inventory/:variantId", (req, res) => {
  try {
    const item = InventoryService.getByVariant(req.params.variantId);
    res.json({ inventory: item });
  } catch (e) { handleErr(e, res); }
});


storeRouter.post("/carts/:id/items", async (req, res) => {
  try {
    const { product_id, variant_id, quantity = 1 } = req.body;
    const cart = await CartService.addItem(req.params.id, product_id, variant_id, quantity);
    res.json({ cart });
  } catch (e) { handleErr(e, res); }
});

storeRouter.patch("/carts/:id/items/:lineId", async (req, res) => {
  try {
    const cart = await CartService.updateItem(req.params.id, req.params.lineId, req.body.quantity);
    res.json({ cart });
  } catch (e) { handleErr(e, res); }
});

storeRouter.delete("/carts/:id/items/:lineId", async (req, res) => {
  try {
    const cart = await CartService.removeItem(req.params.id, req.params.lineId);
    res.json({ cart });
  } catch (e) { handleErr(e, res); }
});

// ─── Orders ─────────────────────────────────────────────────────────────────

storeRouter.post("/orders", async (req, res) => {
  try {
    const order = await OrderService.place(req.body);
    res.status(201).json({ order });
  } catch (e) { handleErr(e, res); }
});

// ─── Auth ───────────────────────────────────────────────────────────────────

storeRouter.post("/auth/register", async (req, res) => {
  try {
    const customer = await AuthService.register(req.body);
    const session  = await AuthService.login(req.body.email, req.body.password);
    res.status(201).json({ customer, session });
  } catch (e) { handleErr(e, res); }
});

storeRouter.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const session = await AuthService.login(email, password);
    const customer = AuthService.validateToken(session.token);
    res.json({ customer, session });
  } catch (e) { handleErr(e, res); }
});

storeRouter.post("/auth/logout", async (req, res) => {
  try {
    const token = req.headers.authorization?.slice(7);
    if (token) await AuthService.logout(token);
    res.json({ success: true });
  } catch (e) { handleErr(e, res); }
});

storeRouter.get("/auth/me", softAuthenticate, (req, res) => {
  res.json({ customer: req.customer });
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


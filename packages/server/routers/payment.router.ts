
import express from "express";
import { PaymentService } from "../../modules/payments/payment.service.ts";

export const paymentRouter = express.Router();

const handleErr = (e: any, res: any) => {
  console.error("[PaymentRouter] Error:", e);
  res.status(e.status || 400).json({ error: { code: e.code || "ERROR", message: e.message } });
};

paymentRouter.post("/initiate", async (req, res) => {
  try {
    const session = await PaymentService.initiate(req.body);
    res.json({ payment_session: session });
  } catch (e) { handleErr(e, res); }
});

paymentRouter.post("/authorize", async (req, res) => {
  try {
    const session = await PaymentService.authorize(req.body.session_id);
    res.json({ payment_session: session });
  } catch (e) { handleErr(e, res); }
});

paymentRouter.post("/capture", async (req, res) => {
  try {
    const session = await PaymentService.capture(req.body);
    res.json({ payment_session: session });
  } catch (e) { handleErr(e, res); }
});

import { Router } from "express";
import paymentController from "../controllers/payment.controller";
const router = Router();

router.post("/pay-debt", paymentController.payDebt);
router.post("/pay-new-debt", paymentController.payNewDebt);
router.post("/postpone-payment", paymentController.postponePayment);

export default router;

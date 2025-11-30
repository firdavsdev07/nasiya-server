import { Router } from "express";
import paymentController from "../controllers/payment.controller";
const router = Router();

router.post("/pay-debt", paymentController.payDebt);
router.post("/pay-new-debt", paymentController.payNewDebt);
router.post("/postpone-payment", paymentController.postponePayment);
router.post("/pay-all-remaining", paymentController.payAllRemainingMonths);

export default router;

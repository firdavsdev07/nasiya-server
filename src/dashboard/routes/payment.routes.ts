import { Router } from "express";
import paymentController from "../controllers/payment.controller";
import { checkPermission } from "../../middlewares/CheckPermission.middleware";
import { Permission } from "../../enums/permission.enum";
const router = Router();

router.put(
  "",
  checkPermission(Permission.UPDATE_CASH),
  paymentController.update
);

router.post(
  "/contract",
  checkPermission(Permission.UPDATE_CASH),
  paymentController.payByContract
);

router.get(
  "/history",
  checkPermission(Permission.VIEW_PAYMENT),
  paymentController.getPaymentHistory
);

// Yangi route'lar - Payment Service uchun
router.post(
  "/receive",
  checkPermission(Permission.UPDATE_CASH),
  paymentController.receivePayment
);

router.post(
  "/confirm",
  checkPermission(Permission.UPDATE_CASH),
  paymentController.confirmPayment
);

router.post(
  "/reject",
  checkPermission(Permission.UPDATE_CASH),
  paymentController.rejectPayment
);

export default router;

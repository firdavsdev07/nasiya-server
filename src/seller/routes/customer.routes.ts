import { Router } from "express";
import { uploadCustomerFiles } from "../../middlewares/upload.middleware";
import AuthMiddleware from "../../middlewares/auth.middleware";
import customerController from "../controllers/customer.controller";

const router = Router();

router.get("/get-new-all", AuthMiddleware, customerController.getAllNew);

router.get("/get-one/:id", AuthMiddleware, customerController.getOne);

router.put(
  "/:id",
  AuthMiddleware,
  uploadCustomerFiles,
  customerController.update
);

router.post("", AuthMiddleware, uploadCustomerFiles, customerController.create);

export default router;

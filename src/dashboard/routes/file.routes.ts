import { Router } from "express";
import fileController from "../controllers/file.controller";
import AuthMiddleware from "../../middlewares/auth.middleware";

const router = Router();

// Download file endpoint - faqat authentication kerak
router.get(
  "/download/:type/:filename",
  AuthMiddleware,
  fileController.downloadFile
);

// Delete file endpoint
router.delete(
  "/delete/:customerId/:type",
  AuthMiddleware,
  fileController.deleteFile
);

export default router;

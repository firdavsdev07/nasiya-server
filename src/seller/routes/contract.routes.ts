import { Router } from "express";
import contractController from "../controllers/contract.controller";
import AuthMiddleware from "../../middlewares/auth.middleware";

const router = Router();

// Shartnomalarni ko'rish (authentication kerak)
router.get("/active", AuthMiddleware, contractController.getActiveContracts);
router.get("/new", AuthMiddleware, contractController.getNewContracts);
router.get(
  "/completed",
  AuthMiddleware,
  contractController.getCompletedContracts
);
router.get("/:id", AuthMiddleware, contractController.getContractById);

// Shartnomani tahrirlash (authentication kerak)
router.put("/:id", AuthMiddleware, contractController.updateContract);

// Shartnoma yaratish (authentication kerak)
router.post("", AuthMiddleware, contractController.create);
router.post("/post", contractController.post);

export default router;

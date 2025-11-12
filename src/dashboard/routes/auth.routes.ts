import { Router } from "express";
import authController from "../controllers/auth.controller";
import AuthMiddleware from "../../middlewares/auth.middleware";

const router = Router();

router.post("/login", authController.login);
router.get("/get-user", AuthMiddleware, authController.getUser);
router.get("/refresh", authController.refresh);
router.get("/logout", authController.logout);

export default router;

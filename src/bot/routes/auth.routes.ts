import { Router } from "express";
import authController from "../controllers/auth.controller";

const router = Router();

router.post("/telegram", authController.telegram);

export default router;

import { Router } from "express";
import dashboardController from "../controllers/dashboard.controller";
const router = Router();

router.get("/", dashboardController.dashboard);
router.get("/currency-course", dashboardController.currencyCourse);

export default router;

import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import settingsRouter from "./settings";
import productsRouter from "./products";
import ordersRouter from "./orders";
import transactionsRouter from "./transactions";
import mpesaRouter from "./mpesa";
import dashboardRouter from "./dashboard";
import storageRouter from "./storage";
import usersRouter from "./users";
import reportsRouter from "./reports";
import { requireAuth } from "../lib/auth";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(settingsRouter);
router.use(mpesaRouter);
router.use(storageRouter);

router.use(requireAuth);
router.use(productsRouter);
router.use(ordersRouter);
router.use(transactionsRouter);
router.use(dashboardRouter);
router.use(usersRouter);
router.use(reportsRouter);

export default router;

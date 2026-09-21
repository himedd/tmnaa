import { Router, type IRouter } from "express";
import healthRouter from "./health";
import followerCountRouter from "./followerCount";
import kickRouter from "./kick";
import { wallRouter, wallErrorHandler } from "./wall";
import { adminRouter } from "./admin";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.use(healthRouter);
router.use(followerCountRouter);
router.use(kickRouter);
router.use(wallRouter);
router.use(adminRouter);
router.use(wallErrorHandler);
router.use((err: unknown, _req: unknown, res: { status: (c: number) => { json: (b: unknown) => unknown } }, _next: unknown) => {
  logger.error({ err }, "unhandled api route error");
  res.status(500).json({ error: "internal_error" });
});

export default router;

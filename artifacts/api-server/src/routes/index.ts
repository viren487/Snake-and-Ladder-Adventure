import { Router, type IRouter } from "express";
import healthRouter from "./health";
import roomsRouter from "./rooms";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/rooms", roomsRouter);

export default router;

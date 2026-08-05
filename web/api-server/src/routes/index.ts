import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import telegramRouter from "./telegram.js";
import keywordsRouter from "./keywords.js";
import resultsRouter from "./results.js";
import botRouter from "./bot.js";
import authRouter from "./auth.js";

const router: IRouter = Router();

router.use("/auth", authRouter);
router.use(healthRouter);
router.use("/telegram", telegramRouter);
router.use("/keywords", keywordsRouter);
router.use("/results", resultsRouter);
router.use("/bot", botRouter);

export default router;

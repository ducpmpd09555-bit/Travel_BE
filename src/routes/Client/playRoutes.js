import express from "express";
import * as playController from "../../controllers/Client/playController.js";
import { authenticate } from "../../middleware/authMiddleware.js"; // Giả định sếp có file này

const router = express.Router();

// Tất cả API của Minigame đều cần đăng nhập
router.use(authenticate);

router.post("/init", playController.initPlay);
router.get("/questions/:locationId", playController.getQuestions);
router.post("/submit", playController.submitAnswers);
router.post("/share", playController.shareToPlay);
router.get("/history", playController.getPlayHistory);
router.get("/rewards", playController.getUserRewards);
router.post("/spin-result", playController.saveSpinResult);
router.get("/locations-progress", playController.getLocationProgress);
export default router;

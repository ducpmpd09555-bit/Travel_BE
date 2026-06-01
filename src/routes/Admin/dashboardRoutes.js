import express from "express";
import {
  getDashboard24h,
  getReport,
} from "../../controllers/Admin/dashboardController.js";
import {
  authenticate,
  authorization,
} from "../../middleware/authMiddleware.js";

const router = express.Router();

// Tất cả API Dashboard yêu cầu quyền admin
router.use(authenticate, authorization(["admin"]));

// 1. Dashboard 24h (Real-time hôm nay)
router.get("/24h", getDashboard24h);

// 2. Report (Thống kê theo biểu đồ ngày, tuần, tháng)
router.get("/report", getReport);

export default router;

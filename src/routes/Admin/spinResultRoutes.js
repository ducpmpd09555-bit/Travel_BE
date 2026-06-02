import express from "express";
import {
  getAllSpinResults,
  getSpinResultById,
  updateSpinResultStatus,
} from "../../controllers/Admin/spinResultController.js";
import {
  authenticate,
  authorization,
} from "../../middleware/authMiddleware.js";

const router = express.Router();

// Tất cả các route quản lý phần thưởng đều yêu cầu quyền Admin
router.use(authenticate, authorization(["admin"]));

// Lấy danh sách (Có hỗ trợ query: ?page=1&limit=10&search=09999999&rewardType=physical)
router.get("/", getAllSpinResults);

// Lấy chi tiết 1 lượt trúng thưởng
router.get("/:id", getSpinResultById);

// Cập nhật trạng thái liên hệ trao quà
router.put("/:id", updateSpinResultStatus);

export default router;

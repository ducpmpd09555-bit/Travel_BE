import express from "express";
import {
  getAllSharePosts,
  getUserShareStats,
  updateSharePostStatus,
} from "../../controllers/Admin/sharePostController.js";
import {
  authenticate,
  authorization,
} from "../../middleware/authMiddleware.js";

const router = express.Router();

// Tất cả API dưới đây đều yêu cầu đăng nhập và có quyền admin
router.use(authenticate, authorization(["admin"]));

// Lấy danh sách toàn bộ bài share cần hậu kiểm (Có hỗ trợ phân trang, search, filter)
router.get("/", getAllSharePosts);

// Xem chi tiết lịch sử share của một user bị đưa vào tầm ngắm
router.get("/user/:userId", getUserShareStats);

// Cập nhật trạng thái (Phạt / Bỏ phạt) và thêm ghi chú
router.put("/:id", updateSharePostStatus);

export default router;

import express from "express";
import {
  getAllUsers,
  getUserById,
  updateUser,
  lockUser,
} from "../../controllers/Admin/userController.js";
import {
  authenticate,
  authorization,
} from "../../middleware/authMiddleware.js";

const router = express.Router();

// Tất cả các route dưới đây đều yêu cầu đăng nhập và có quyền 'admin'
router.use(authenticate, authorization(["admin"]));

// ================== ADMIN USER ROUTES ==================
router.get("/", getAllUsers);
router.get("/:id", getUserById);
router.put("/:id", updateUser);
router.patch("/:id/lock", lockUser); // Sử dụng PATCH cho thao tác lock/unlock cụ thể

export default router;

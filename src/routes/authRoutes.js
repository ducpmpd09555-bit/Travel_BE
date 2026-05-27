import express from "express";

import {
  register,
  login,
  refreshToken,
  logout,
  getProfile,
  updateProfile,
  changePassword,
} from "../controllers/authController.js";

import { authenticate } from "../middleware/authMiddleware.js";

const router = express.Router();

// ================== PUBLIC ROUTES ==================
router.post("/register", register);
router.post("/login", login);
router.post("/refresh-token", refreshToken);
router.post("/logout", logout);

// ================== USER ROUTES ==================
router.get("/profile", authenticate, getProfile);
router.put("/profile", authenticate, updateProfile);
router.put("/change-password", authenticate, changePassword);

export default router;

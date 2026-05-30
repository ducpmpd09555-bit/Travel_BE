import express from "express";
import {
  getActiveCountries,
  getActiveLocations,
} from "../../controllers/Client/mapController.js";
import { authenticate } from "../../middleware/authMiddleware.js";

const router = express.Router();

// Yêu cầu User phải Đăng nhập mới được gọi API xem Map
router.use(authenticate);

// Dùng method GET và nhận tham số qua req.query
router.get("/countries", getActiveCountries); // Cần query: ?campaign_id=1
router.get("/locations", getActiveLocations); // Cần query: ?country_id=1

export default router;

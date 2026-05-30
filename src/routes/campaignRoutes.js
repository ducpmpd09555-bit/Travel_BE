import express from "express";
import { getActiveCampaign } from "../controllers/Admin/campaignController.js";
import { getCampaignById } from "../controllers/Client/campaignController.js";
const router = express.Router();

// Public route, ai vào web cũng xem được chiến dịch đang chạy
router.get("/active", getActiveCampaign);
router.get("/:id", getCampaignById);
export default router;

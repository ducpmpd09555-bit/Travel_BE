import express from "express";
import {
  createCampaign,
  getAllCampaigns,
  getCampaignById,
  updateCampaign,
} from "../../controllers/Admin/campaignController.js";
import {
  authenticate,
  authorization,
} from "../../middleware/authMiddleware.js";

const router = express.Router();

router.use(authenticate, authorization(["admin"]));

router.post("/", createCampaign);
router.get("/", getAllCampaigns);
router.get("/:id", getCampaignById);
router.put("/:id", updateCampaign);

export default router;

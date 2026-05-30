import express from "express";
import {
  createReward,
  getAllRewards,
  getRewardById,
  updateReward,
} from "../../controllers/Admin/rewardController.js";
import {
  authenticate,
  authorization,
} from "../../middleware/authMiddleware.js";

const router = express.Router();

router.use(authenticate, authorization(["admin"]));

router.post("/", createReward);
router.get("/", getAllRewards);
router.get("/:id", getRewardById);
router.put("/:id", updateReward);

export default router;

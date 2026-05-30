import express from "express";
import { getRewardsForUser } from "../../controllers/Client/rewardController.js";

const router = express.Router();
// Không cần authenticate vì ai cũng có thể xem quà để lấy động lực chơi
router.get("/", getRewardsForUser);

export default router;

import express from "express";
import { getQuestionsForUser } from "../../controllers/Client/questionController.js";
import { authenticate } from "../../middleware/authMiddleware.js";

const router = express.Router();

router.use(authenticate); // User phải đăng nhập mới được xem câu hỏi
router.get("/", getQuestionsForUser);

export default router;

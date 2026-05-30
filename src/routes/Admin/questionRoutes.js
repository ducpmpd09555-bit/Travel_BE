import express from "express";
import {
  createQuestion,
  getAllQuestions,
  getQuestionById,
  updateQuestion,
} from "../../controllers/Admin/questionController.js";
import {
  authenticate,
  authorization,
} from "../../middleware/authMiddleware.js";

const router = express.Router();

router.use(authenticate, authorization(["admin"]));

router.post("/", createQuestion);
router.get("/", getAllQuestions);
router.get("/:id", getQuestionById);
router.put("/:id", updateQuestion);

export default router;

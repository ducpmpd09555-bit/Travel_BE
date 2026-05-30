import * as questionService from "../../services/Admin/questionService.js";

export const createQuestion = async (req, res) => {
  try {
    const data = await questionService.createQuestionService(req.body);
    return res.status(201).json({
      success: true,
      message: "Tạo câu hỏi và bộ đáp án thành công",
      data,
    });
  } catch (error) {
    return res
      .status(error.status || 500)
      .json({ success: false, message: error.message });
  }
};

export const getAllQuestions = async (req, res) => {
  try {
    const data = await questionService.getAllQuestionsService(req.query);
    return res.status(200).json({
      success: true,
      message: "Lấy danh sách câu hỏi thành công",
      ...data,
    });
  } catch (error) {
    return res
      .status(error.status || 500)
      .json({ success: false, message: error.message });
  }
};

export const getQuestionById = async (req, res) => {
  try {
    const data = await questionService.getQuestionByIdService(req.params.id);
    return res.status(200).json({
      success: true,
      message: "Lấy chi tiết câu hỏi thành công",
      data,
    });
  } catch (error) {
    return res
      .status(error.status || 500)
      .json({ success: false, message: error.message });
  }
};

export const updateQuestion = async (req, res) => {
  try {
    const data = await questionService.updateQuestionService(
      req.params.id,
      req.body,
    );
    return res
      .status(200)
      .json({ success: true, message: "Cập nhật câu hỏi thành công", data });
  } catch (error) {
    return res
      .status(error.status || 500)
      .json({ success: false, message: error.message });
  }
};

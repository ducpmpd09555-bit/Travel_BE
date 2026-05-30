import * as questionService from "../../services/Client/questionService.js";

export const getQuestionsForUser = async (req, res) => {
  try {
    const { location_id, category } = req.query;

    if (!location_id || !category) {
      return res
        .status(400)
        .json({ success: false, message: "Thiếu location_id hoặc category" });
    }

    const data = await questionService.getQuestionsForUserService(
      location_id,
      category,
    );
    return res
      .status(200)
      .json({ success: true, message: "Lấy bộ câu hỏi thành công", data });
  } catch (error) {
    return res
      .status(error.status || 500)
      .json({ success: false, message: error.message });
  }
};

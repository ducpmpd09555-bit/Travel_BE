import {
  getAllSharePostsService,
  getUserShareStatsService,
  updateSharePostStatusService,
} from "../../services/Admin/sharePostService.js";

export const getAllSharePosts = async (req, res) => {
  try {
    const data = await getAllSharePostsService(req.query);
    return res
      .status(200)
      .json({
        success: true,
        message: "Lấy danh sách hậu kiểm thành công",
        ...data,
      });
  } catch (error) {
    return res
      .status(error.status || 500)
      .json({ success: false, message: error.message });
  }
};

export const getUserShareStats = async (req, res) => {
  try {
    const data = await getUserShareStatsService(req.params.userId);
    return res
      .status(200)
      .json({ success: true, message: "Lấy thống kê User thành công", data });
  } catch (error) {
    return res
      .status(error.status || 500)
      .json({ success: false, message: error.message });
  }
};

export const updateSharePostStatus = async (req, res) => {
  try {
    const data = await updateSharePostStatusService(req.params.id, req.body);
    return res
      .status(200)
      .json({ success: true, message: "Cập nhật trạng thái thành công", data });
  } catch (error) {
    return res
      .status(error.status || 500)
      .json({ success: false, message: error.message });
  }
};

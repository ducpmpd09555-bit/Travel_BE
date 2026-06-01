import * as playService from "../../services/Client/playService.js";

// 1. Khởi tạo lượt chơi
export const initPlay = async (req, res) => {
  try {
    const userId = req.user.id;
    const { location_id, campaign_id } = req.body;

    if (!location_id || !campaign_id) {
      return res.status(400).json({
        success: false,
        message: "Thiếu location_id hoặc campaign_id",
      });
    }

    const data = await playService.initPlaySessionService(
      userId,
      location_id,
      campaign_id,
    );
    return res
      .status(200)
      .json({ success: true, message: "Khởi tạo thành công", data: data });
  } catch (error) {
    if (error.message === "OUT_OF_PLAYS_NEED_SHARE") {
      return res.status(403).json({
        success: false,
        code: "NEED_SHARE",
        message: "Bạn đã hết lượt chơi hôm nay. Hãy chia sẻ để nhận thêm nhé!",
      });
    }
    if (error.message === "OUT_OF_PLAYS_COME_TOMORROW") {
      return res.status(403).json({
        success: false,
        code: "COME_TOMORROW",
        message:
          "Hôm nay bạn đã dùng hết quyền trợ giúp. Quay lại vào ngày mai nhé!",
      });
    }
    console.error("Lỗi initPlay:", error);
    return res
      .status(500)
      .json({ success: false, message: "Lỗi máy chủ nội bộ" });
  }
};

// 2. Lấy bộ câu hỏi
export const getQuestions = async (req, res) => {
  try {
    const { locationId } = req.params;
    const { category } = req.query;

    if (!category)
      return res
        .status(400)
        .json({ success: false, message: "Thiếu tham số category" });

    const questions = await playService.getQuestionsForUserService(
      locationId,
      category,
    );
    return res.status(200).json({ success: true, data: questions });
  } catch (error) {
    console.error("Lỗi getQuestions:", error);
    return res
      .status(500)
      .json({ success: false, message: "Lỗi máy chủ nội bộ" });
  }
};

// 3. Nộp bài & Chấm điểm
export const submitAnswers = async (req, res) => {
  try {
    const userId = req.user.id;
    const { session_id, answers } = req.body;

    if (!session_id || !answers || !Array.isArray(answers)) {
      return res
        .status(400)
        .json({ success: false, message: "Dữ liệu nộp bài không hợp lệ" });
    }

    const result = await playService.submitAnswersService(
      userId,
      session_id,
      answers,
    );
    return res
      .status(200)
      .json({ success: true, message: "Chấm điểm thành công", data: result });
  } catch (error) {
    if (error.message === "SESSION_NOT_FOUND")
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy phiên chơi" });
    if (error.message === "SESSION_ALREADY_SUBMITTED")
      return res
        .status(400)
        .json({ success: false, message: "Phiên chơi này đã được nộp" });
    console.error("Lỗi submitAnswers:", error);
    return res
      .status(500)
      .json({ success: false, message: "Lỗi máy chủ nội bộ" });
  }
};

// 4. Share nhận lượt
export const shareToPlay = async (req, res) => {
  try {
    const userId = req.user.id;
    const { campaign_id, post_url } = req.body;

    if (!campaign_id || !post_url) {
      return res.status(400).json({
        success: false,
        message: "Thiếu campaign_id hoặc link bài viết",
      });
    }

    const result = await playService.submitShareLinkService(
      userId,
      campaign_id,
      post_url,
    );
    return res.status(200).json({ success: true, message: result.message });
  } catch (error) {
    if (error.message === "INVALID_FB_URL")
      return res
        .status(400)
        .json({ success: false, message: "Link Facebook không hợp lệ" });
    if (error.message === "MUST_PLAY_BEFORE_SHARE")
      return res.status(400).json({
        success: false,
        message: "Bạn phải khởi tạo lượt chơi trước khi share",
      });
    if (error.message === "ALREADY_SHARED_TODAY")
      return res.status(403).json({
        success: false,
        message: "Bạn đã nhận thưởng chia sẻ hôm nay rồi!",
      });
    console.error("Lỗi shareToPlay:", error);
    return res
      .status(500)
      .json({ success: false, message: "Lỗi máy chủ nội bộ" });
  }
};

// 5. Lấy lịch sử chơi
export const getPlayHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const { campaign_id } = req.query; // Có hay không có đều được

    const history = await playService.getPlayHistoryService(
      userId,
      campaign_id,
    );
    return res.status(200).json({
      success: true,
      message: "Lấy lịch sử chơi thành công",
      data: history,
    });
  } catch (error) {
    console.error("Lỗi getPlayHistory:", error);
    return res
      .status(500)
      .json({ success: false, message: "Lỗi máy chủ nội bộ" });
  }
};

// 6. Lấy danh sách quà
export const getUserRewards = async (req, res) => {
  try {
    const userId = req.user.id;
    const { campaign_id } = req.query; // Có hay không có đều được

    const rewards = await playService.getUserRewardsService(
      userId,
      campaign_id,
    );
    return res.status(200).json({
      success: true,
      message: "Lấy danh sách quà thành công",
      data: rewards,
    });
  } catch (error) {
    console.error("Lỗi getUserRewards:", error);
    return res
      .status(500)
      .json({ success: false, message: "Lỗi máy chủ nội bộ" });
  }
};

// 7. LƯU KẾT QUẢ VÒNG QUAY (GỌI KHI VÒNG QUAY DỪNG LẠI)
export const saveSpinResult = async (req, res) => {
  try {
    const userId = req.user.id;
    const { session_id, campaign_id } = req.body;

    if (!session_id || !campaign_id) {
      return res
        .status(400)
        .json({ success: false, message: "Thiếu dữ liệu lưu kết quả quay" });
    }

    const result = await playService.saveSpinResultService(
      userId,
      session_id,
      campaign_id,
    );
    return res.status(200).json({
      success: true,
      message: "Lưu kết quả quay thành công",
      data: result,
    });
  } catch (error) {
    if (error.message === "SESSION_NOT_FOUND")
      return res
        .status(404)
        .json({ success: false, message: "Phiên chơi không tồn tại" });
    if (error.message === "ALREADY_SPUN_OR_NOT_ELIGIBLE")
      return res.status(403).json({
        success: false,
        message: "Phiên này đã quay hoặc chưa đủ điều kiện quay",
      });
    if (error.message === "REWARD_NOT_FOUND")
      return res
        .status(404)
        .json({ success: false, message: "Phần thưởng không tồn tại" });
    console.error("Lỗi saveSpinResult:", error);
    return res
      .status(500)
      .json({ success: false, message: "Lỗi máy chủ nội bộ" });
  }
};

export const getLocationProgress = async (req, res) => {
  try {
    // 1. Lấy userId từ token (Nếu chưa đăng nhập sẽ bị văng lỗi ở middleware)
    const userId = req.user.id;
    const { campaign_id } = req.query;

    if (!campaign_id) {
      return res
        .status(400)
        .json({ success: false, message: "Thiếu campaign_id" });
    }

    // 2. ĐÃ FIX LỖI TYPO: Truyền đúng biến campaign_id vào service
    const progress = await playService.getLocationProgressService(
      userId,
      campaign_id,
    );

    return res.status(200).json({ success: true, data: progress });
  } catch (error) {
    // Thêm dòng log này để lỡ SQL có lỗi sếp nhìn Terminal BE là thấy ngay
    console.error("🔥 Lỗi tại getLocationProgress Controller:", error);
    return res
      .status(500)
      .json({ success: false, message: "Lỗi máy chủ nội bộ" });
  }
};

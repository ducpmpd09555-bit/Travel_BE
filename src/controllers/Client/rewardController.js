import * as rewardService from "../../services/Client/rewardService.js";

export const getRewardsForUser = async (req, res) => {
  try {
    const { campaign_id } = req.query;
    if (!campaign_id) {
      return res
        .status(400)
        .json({ success: false, message: "Thiếu campaign_id" });
    }

    const data = await rewardService.getRewardsForUserService(campaign_id);
    return res
      .status(200)
      .json({
        success: true,
        message: "Lấy danh sách phần thưởng thành công",
        data,
      });
  } catch (error) {
    return res
      .status(error.status || 500)
      .json({ success: false, message: error.message });
  }
};

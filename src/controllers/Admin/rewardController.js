import * as rewardService from "../../services/Admin/rewardService.js";

export const createReward = async (req, res) => {
  try {
    const data = await rewardService.createRewardService(req.body);
    return res
      .status(201)
      .json({
        success: true,
        message: "Nhập kho phần thưởng thành công",
        data,
      });
  } catch (error) {
    return res
      .status(error.status || 500)
      .json({ success: false, message: error.message });
  }
};

export const getAllRewards = async (req, res) => {
  try {
    const data = await rewardService.getAllRewardsService(req.query);
    return res
      .status(200)
      .json({
        success: true,
        message: "Lấy danh sách phần thưởng thành công",
        ...data,
      });
  } catch (error) {
    return res
      .status(error.status || 500)
      .json({ success: false, message: error.message });
  }
};

export const getRewardById = async (req, res) => {
  try {
    const data = await rewardService.getRewardByIdService(req.params.id);
    return res
      .status(200)
      .json({
        success: true,
        message: "Lấy chi tiết phần thưởng thành công",
        data,
      });
  } catch (error) {
    return res
      .status(error.status || 500)
      .json({ success: false, message: error.message });
  }
};

export const updateReward = async (req, res) => {
  try {
    const data = await rewardService.updateRewardService(
      req.params.id,
      req.body,
    );
    return res
      .status(200)
      .json({
        success: true,
        message: "Cập nhật phần thưởng thành công",
        data,
      });
  } catch (error) {
    return res
      .status(error.status || 500)
      .json({ success: false, message: error.message });
  }
};

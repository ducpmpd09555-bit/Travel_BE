import {
  createCampaignService,
  getAllCampaignsService,
  updateCampaignService,
  getActiveCampaignService,
  getCampaignByIdService,
} from "../../services/Admin/campaignService.js";

export const createCampaign = async (req, res) => {
  try {
    const data = await createCampaignService(req.body);
    return res
      .status(201)
      .json({ success: true, message: "Tạo chiến dịch thành công", data });
  } catch (error) {
    return res
      .status(error.status || 500)
      .json({ success: false, message: error.message });
  }
};

export const getAllCampaigns = async (req, res) => {
  try {
    const data = await getAllCampaignsService(req.query);
    return res
      .status(200)
      .json({ success: true, message: "Lấy danh sách thành công", ...data });
  } catch (error) {
    return res
      .status(error.status || 500)
      .json({ success: false, message: error.message });
  }
};

export const updateCampaign = async (req, res) => {
  try {
    const data = await updateCampaignService(req.params.id, req.body);
    return res
      .status(200)
      .json({ success: true, message: "Cập nhật thành công", data });
  } catch (error) {
    return res
      .status(error.status || 500)
      .json({ success: false, message: error.message });
  }
};
export const getCampaignById = async (req, res) => {
  try {
    const data = await getCampaignByIdService(req.params.id);
    return res
      .status(200)
      .json({ success: true, message: "Lấy chi tiết thành công", data });
  } catch (error) {
    return res
      .status(error.status || 500)
      .json({ success: false, message: error.message });
  }
};

// Khách hàng (User) gọi API này
export const getActiveCampaign = async (req, res) => {
  try {
    const data = await getActiveCampaignService();
    if (!data) {
      return res.status(200).json({
        success: true,
        message: "Hiện không có chiến dịch nào đang diễn ra",
        data: null,
      });
    }
    return res
      .status(200)
      .json({ success: true, message: "Lấy chiến dịch thành công", data });
  } catch (error) {
    return res
      .status(error.status || 500)
      .json({ success: false, message: error.message });
  }
};

import { getCampaignByIdService } from "../../services/Client/campaignService.js";

// ... (các hàm cũ như getActiveCampaign để nguyên ở trên) ...

export const getCampaignById = async (req, res) => {
  try {
    const { id } = req.params;

    // Ràng buộc id phải là số (tránh lỗi SQL Injection hoặc crash app khi truyền text bậy bạ)
    if (isNaN(id)) {
      return res
        .status(400)
        .json({ success: false, message: "ID chiến dịch không hợp lệ" });
    }

    const campaign = await getCampaignByIdService(id);

    res.status(200).json({
      success: true,
      data: campaign,
    });
  } catch (error) {
    const status = error.status || 500;
    const message = error.message || "Lỗi server khi lấy thông tin chiến dịch";
    res.status(status).json({ success: false, message });
  }
};

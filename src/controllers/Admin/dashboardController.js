import {
  getDashboard24hService,
  getReportService,
} from "../../services/Admin/dashboardService.js";

// ======================================================================
// API: GET DASHBOARD 24H REALTIME
// ======================================================================
export const getDashboard24h = async (req, res) => {
  try {
    const data = await getDashboard24hService();
    return res.status(200).json({
      success: true,
      message: "Lấy dữ liệu Dashboard 24h thành công",
      data,
    });
  } catch (error) {
    console.error("🔥 Error Dashboard 24h:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Lỗi máy chủ nội bộ",
    });
  }
};

// ======================================================================
// API: GET REPORT (BÁO CÁO THEO KHOẢNG THỜI GIAN)
// ======================================================================
export const getReport = async (req, res) => {
  try {
    const { from_date, to_date, type = "day" } = req.query;

    if (!from_date || !to_date) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng cung cấp from_date và to_date",
      });
    }

    const data = await getReportService({ from_date, to_date, type });

    return res.status(200).json({
      success: true,
      message: "Lấy dữ liệu Báo cáo thành công",
      data,
    });
  } catch (error) {
    console.error("🔥 Error Report:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Lỗi máy chủ nội bộ",
    });
  }
};

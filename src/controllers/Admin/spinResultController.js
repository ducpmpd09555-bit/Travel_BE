import {
  getAllSpinResultsService,
  getSpinResultByIdService,
  updateSpinResultStatusService,
} from "../../services/Admin/spinResultService.js";

export const getAllSpinResults = async (req, res) => {
  try {
    const data = await getAllSpinResultsService(req.query);
    return res.status(200).json({
      success: true,
      message: "Lấy danh sách trúng thưởng thành công",
      ...data,
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getSpinResultById = async (req, res) => {
  try {
    const data = await getSpinResultByIdService(req.params.id);
    return res.status(200).json({
      success: true,
      message: "Lấy chi tiết trúng thưởng thành công",
      data,
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      success: false,
      message: error.message,
    });
  }
};

export const updateSpinResultStatus = async (req, res) => {
  try {
    const data = await updateSpinResultStatusService(req.params.id, req.body);
    return res.status(200).json({
      success: true,
      message: "Cập nhật trạng thái phát quà thành công",
      data,
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      success: false,
      message: error.message,
    });
  }
};

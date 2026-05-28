import {
  getAllUsersService,
  getUserByIdService,
  updateUserService,
  lockUserService,
} from "../../services/Admin/userService.js";

export const getAllUsers = async (req, res) => {
  try {
    const data = await getAllUsersService(req.query);
    return res.status(200).json({
      success: true,
      message: "Lấy danh sách người dùng thành công",
      data: data.users,
      pagination: data.pagination,
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Lỗi server khi lấy danh sách người dùng",
    });
  }
};

export const getUserById = async (req, res) => {
  try {
    const data = await getUserByIdService(req.params.id);
    return res.status(200).json({
      success: true,
      message: "Lấy thông tin người dùng thành công",
      data,
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Lỗi server khi lấy chi tiết người dùng",
    });
  }
};

export const updateUser = async (req, res) => {
  try {
    // Ngăn admin tự cập nhật ID hoặc thông tin nhạy cảm ở route này
    const data = await updateUserService(req.params.id, req.body);
    return res.status(200).json({
      success: true,
      message: "Cập nhật người dùng thành công",
      data,
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Lỗi server khi cập nhật người dùng",
    });
  }
};

export const lockUser = async (req, res) => {
  try {
    // Không cho phép Admin tự khóa chính mình
    if (parseInt(req.params.id, 10) === req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Không thể tự khóa tài khoản của chính mình",
      });
    }

    const data = await lockUserService(req.params.id, req.body);
    return res.status(200).json({
      success: true,
      message: req.body.is_locked
        ? "Đã khóa tài khoản"
        : "Đã mở khóa tài khoản",
      data,
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Lỗi server khi thao tác khóa/mở khóa",
    });
  }
};

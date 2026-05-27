import {
  registerService,
  loginService,
  refreshTokenService,
  logoutService,
  getProfileService,
  updateProfileService,
  changePasswordService,
} from "../services/authService.js";

// ================== REGISTER ==================
export const register = async (req, res) => {
  try {
    const data = await registerService(req.body);

    return res.status(201).json({
      success: true,
      message: "Đăng ký tài khoản thành công",
      data,
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Lỗi server khi đăng ký",
    });
  }
};

// ================== LOGIN ==================
export const login = async (req, res) => {
  try {
    const data = await loginService(req.body);

    return res.status(200).json({
      success: true,
      message: "Đăng nhập thành công",
      data,
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Lỗi server khi đăng nhập",
    });
  }
};

// ================== REFRESH TOKEN ==================
export const refreshToken = async (req, res) => {
  try {
    const data = await refreshTokenService(req.body);

    return res.status(200).json({
      success: true,
      message: "Làm mới token thành công",
      data,
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Lỗi server khi làm mới token",
    });
  }
};

// ================== LOGOUT ==================
export const logout = async (req, res) => {
  try {
    const data = await logoutService(req.body);

    return res.status(200).json({
      success: true,
      message: data.message,
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Lỗi server khi đăng xuất",
    });
  }
};

// ================== GET PROFILE ==================
export const getProfile = async (req, res) => {
  try {
    const user = await getProfileService(req.user.id);

    return res.status(200).json({
      success: true,
      message: "Lấy thông tin cá nhân thành công",
      data: user,
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Lỗi server khi lấy thông tin cá nhân",
    });
  }
};

// ================== UPDATE PROFILE ==================
export const updateProfile = async (req, res) => {
  try {
    const user = await updateProfileService(req.user.id, req.body);

    return res.status(200).json({
      success: true,
      message: "Cập nhật thông tin cá nhân thành công",
      data: user,
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Lỗi server khi cập nhật thông tin cá nhân",
    });
  }
};

// ================== CHANGE PASSWORD ==================
export const changePassword = async (req, res) => {
  try {
    const data = await changePasswordService(req.user.id, req.body);

    return res.status(200).json({
      success: true,
      message: data.message,
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Lỗi server khi đổi mật khẩu",
    });
  }
};

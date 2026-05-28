import pool from "../config/db.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const SALT = 10;

const generateAccessToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      phone: user.phone,
      role: user.role,
    },
    process.env.JWT_ACCESS_SECRET,
    {
      expiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN || "15m",
    },
  );
};

const generateRefreshToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      phone: user.phone,
      role: user.role,
    },
    process.env.JWT_REFRESH_SECRET,
    {
      expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || "7d",
    },
  );
};

const saveRefreshToken = async (userId, refreshToken) => {
  const decoded = jwt.decode(refreshToken);
  const expiredAt = new Date(decoded.exp * 1000);

  await pool.query(
    `
    INSERT INTO refresh_tokens (
      user_id,
      token,
      expired_at
    )
    VALUES ($1, $2, $3)
    `,
    [userId, refreshToken, expiredAt],
  );
};

const createTokenPair = async (user) => {
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  await saveRefreshToken(user.id, refreshToken);

  return {
    accessToken,
    refreshToken,
  };
};

const checkUserLocked = (user) => {
  if (user.is_locked || user.status === "locked") {
    let msg = "Tài khoản đã bị khóa";

    if (user.lock_until) {
      msg += ` đến ${new Date(user.lock_until).toLocaleString("vi-VN")}`;
    }

    if (user.lock_reason) {
      msg += `, lý do: ${user.lock_reason}`;
    }

    const err = new Error(msg);
    err.status = 403;
    throw err;
  }

  if (user.status !== "active") {
    const err = new Error("Tài khoản không còn hoạt động");
    err.status = 403;
    throw err;
  }
};

// ================== REGISTER ==================
export const registerService = async ({
  username,
  phone,
  password,
  confirmPassword,
  area,
}) => {
  if (!username || !phone || !password || !confirmPassword || !area) {
    const err = new Error("Vui lòng nhập đầy đủ thông tin");
    err.status = 400;
    throw err;
  }

  if (password !== confirmPassword) {
    const err = new Error("Mật khẩu nhập lại không khớp");
    err.status = 400;
    throw err;
  }

  const normalizedUsername = username.trim();
  const normalizedPhone = phone.trim();
  const normalizedArea = area.trim();

  const finalAreaType =
    normalizedArea.toLowerCase() === "đà nẵng" ||
    normalizedArea.toLowerCase() === "da nang"
      ? "danang"
      : "outside_danang";

  const existedUser = await pool.query(
    `
    SELECT id, username, phone
    FROM users
    WHERE phone = $1 OR username = $2
    `,
    [normalizedPhone, normalizedUsername],
  );

  if (existedUser.rows.length > 0) {
    const existed = existedUser.rows[0];

    if (existed.phone === normalizedPhone) {
      const err = new Error("Số điện thoại đã được đăng ký");
      err.status = 409;
      throw err;
    }

    if (existed.username === normalizedUsername) {
      const err = new Error("Tên người dùng đã tồn tại");
      err.status = 409;
      throw err;
    }
  }

  const hashedPassword = await bcrypt.hash(password, SALT);

  const result = await pool.query(
    `
    INSERT INTO users (
      username,
      phone,
      password,
      area,
      area_type
    )
    VALUES ($1, $2, $3, $4, $5)
    RETURNING
      id,
      username,
      phone,
      area,
      area_type,
      role,
      status,
      is_locked,
      locked_at,
      lock_until,
      lock_reason,
      created_at,
      updated_at
    `,
    [
      normalizedUsername,
      normalizedPhone,
      hashedPassword,
      normalizedArea,
      finalAreaType,
    ],
  );

  const user = result.rows[0];
  const tokens = await createTokenPair(user);

  return {
    user,
    ...tokens,
  };
};

// ================== LOGIN ==================
export const loginService = async ({ phone, password }) => {
  if (!phone || !password) {
    const err = new Error("Vui lòng nhập số điện thoại và mật khẩu");
    err.status = 400;
    throw err;
  }

  const normalizedPhone = phone.trim();

  const result = await pool.query(
    `
    SELECT
      id,
      username,
      phone,
      password,
      area,
      area_type,
      role,
      status,
      is_locked,
      locked_at,
      lock_until,
      lock_reason,
      created_at,
      updated_at
    FROM users
    WHERE phone = $1
    `,
    [normalizedPhone],
  );

  if (result.rows.length === 0) {
    const err = new Error("Số điện thoại hoặc mật khẩu không đúng");
    err.status = 401;
    throw err;
  }

  const user = result.rows[0];

  checkUserLocked(user);

  const isMatch = await bcrypt.compare(password, user.password);

  if (!isMatch) {
    const err = new Error("Số điện thoại hoặc mật khẩu không đúng");
    err.status = 401;
    throw err;
  }

  delete user.password;

  const tokens = await createTokenPair(user);

  return {
    user,
    ...tokens,
  };
};

// ================== REFRESH TOKEN ==================
export const refreshTokenService = async ({ refreshToken }) => {
  if (!refreshToken) {
    const err = new Error("Thiếu refresh token");
    err.status = 400;
    throw err;
  }

  let decoded;

  try {
    decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
  } catch (error) {
    const err = new Error("Refresh token không hợp lệ hoặc đã hết hạn");
    err.status = 401;
    throw err;
  }

  const tokenRes = await pool.query(
    `
    SELECT id, user_id, token, expired_at, revoked_at
    FROM refresh_tokens
    WHERE token = $1
    `,
    [refreshToken],
  );

  if (tokenRes.rows.length === 0) {
    const err = new Error("Refresh token không tồn tại");
    err.status = 401;
    throw err;
  }

  const savedToken = tokenRes.rows[0];

  if (savedToken.revoked_at) {
    const err = new Error("Refresh token đã bị thu hồi");
    err.status = 401;
    throw err;
  }

  if (new Date(savedToken.expired_at) < new Date()) {
    const err = new Error("Refresh token đã hết hạn");
    err.status = 401;
    throw err;
  }

  const userRes = await pool.query(
    `
    SELECT
      id,
      username,
      phone,
      area,
      area_type,
      role,
      status,
      is_locked,
      locked_at,
      lock_until,
      lock_reason,
      created_at,
      updated_at
    FROM users
    WHERE id = $1
    `,
    [decoded.id],
  );

  if (userRes.rows.length === 0) {
    const err = new Error("Người dùng không tồn tại");
    err.status = 404;
    throw err;
  }

  const user = userRes.rows[0];

  checkUserLocked(user);

  await pool.query(
    `
    UPDATE refresh_tokens
    SET revoked_at = CURRENT_TIMESTAMP
    WHERE token = $1
    `,
    [refreshToken],
  );

  const tokens = await createTokenPair(user);

  return {
    user,
    ...tokens,
  };
};

// ================== LOGOUT ==================
export const logoutService = async ({ refreshToken }) => {
  if (!refreshToken) {
    const err = new Error("Thiếu refresh token");
    err.status = 400;
    throw err;
  }

  await pool.query(
    `
    UPDATE refresh_tokens
    SET revoked_at = CURRENT_TIMESTAMP
    WHERE token = $1
    `,
    [refreshToken],
  );

  return {
    message: "Đăng xuất thành công",
  };
};

// ================== GET PROFILE ==================
export const getProfileService = async (userId) => {
  const result = await pool.query(
    `
    SELECT
      id,
      username,
      phone,
      area,
      area_type,
      role,
      status,
      is_locked,
      locked_at,
      lock_until,
      lock_reason,
      created_at,
      updated_at
    FROM users
    WHERE id = $1
    `,
    [userId],
  );

  if (result.rows.length === 0) {
    const err = new Error("Không tìm thấy người dùng");
    err.status = 404;
    throw err;
  }

  return result.rows[0];
};

// ================== UPDATE PROFILE ==================
// ================== UPDATE PROFILE ==================
export const updateProfileService = async (
  userId,
  { username, phone, area },
) => {
  if (!username || !phone || !area) {
    const err = new Error(
      "Họ tên, số điện thoại và khu vực không được để trống",
    );
    err.status = 400;
    throw err;
  }

  const normalizedUsername = username.trim();
  const normalizedPhone = phone.trim();
  const normalizedArea = area.trim();

  const finalAreaType =
    normalizedArea.toLowerCase() === "đà nẵng" ||
    normalizedArea.toLowerCase() === "da nang"
      ? "danang"
      : "outside_danang";

  const existedUser = await pool.query(
    `
    SELECT id, username, phone
    FROM users
    WHERE (phone = $1 OR username = $2)
      AND id != $3
    `,
    [normalizedPhone, normalizedUsername, userId],
  );

  if (existedUser.rows.length > 0) {
    const existed = existedUser.rows[0];

    if (existed.phone === normalizedPhone) {
      const err = new Error("Số điện thoại đã được người khác sử dụng");
      err.status = 409;
      throw err;
    }

    if (existed.username === normalizedUsername) {
      const err = new Error("Tên người dùng đã được người khác sử dụng");
      err.status = 409;
      throw err;
    }
  }

  const result = await pool.query(
    `
    UPDATE users
    SET
      username = $1,
      phone = $2,
      area = $3,
      area_type = $4,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $5
    RETURNING
      id,
      username,
      phone,
      area,
      area_type,
      role,
      status,
      is_locked,
      locked_at,
      lock_until,
      lock_reason,
      created_at,
      updated_at
    `,
    [
      normalizedUsername,
      normalizedPhone,
      normalizedArea,
      finalAreaType,
      userId,
    ],
  );

  if (result.rows.length === 0) {
    const err = new Error("Không tìm thấy người dùng");
    err.status = 404;
    throw err;
  }

  return result.rows[0];
};

// ================== CHANGE PASSWORD ==================
export const changePasswordService = async (
  userId,
  { oldPassword, newPassword, confirmNewPassword },
) => {
  if (!oldPassword || !newPassword || !confirmNewPassword) {
    const err = new Error("Vui lòng nhập đầy đủ thông tin mật khẩu");
    err.status = 400;
    throw err;
  }

  if (newPassword !== confirmNewPassword) {
    const err = new Error("Mật khẩu mới nhập lại không khớp");
    err.status = 400;
    throw err;
  }

  if (oldPassword === newPassword) {
    const err = new Error("Mật khẩu mới không được trùng mật khẩu cũ");
    err.status = 400;
    throw err;
  }

  const result = await pool.query(
    `
    SELECT 
      id,
      password,
      status,
      is_locked,
      locked_at,
      lock_until,
      lock_reason
    FROM users
    WHERE id = $1
    `,
    [userId],
  );

  if (result.rows.length === 0) {
    const err = new Error("Không tìm thấy người dùng");
    err.status = 404;
    throw err;
  }

  const user = result.rows[0];

  checkUserLocked(user);

  const isMatch = await bcrypt.compare(oldPassword, user.password);

  if (!isMatch) {
    const err = new Error("Mật khẩu cũ không đúng");
    err.status = 401;
    throw err;
  }

  const hashedPassword = await bcrypt.hash(newPassword, SALT);

  await pool.query(
    `
    UPDATE users
    SET
      password = $1,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $2
    `,
    [hashedPassword, userId],
  );

  await pool.query(
    `
    UPDATE refresh_tokens
    SET revoked_at = CURRENT_TIMESTAMP
    WHERE user_id = $1 AND revoked_at IS NULL
    `,
    [userId],
  );

  return {
    message: "Đổi mật khẩu thành công, vui lòng đăng nhập lại",
  };
};

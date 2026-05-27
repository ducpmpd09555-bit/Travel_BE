import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import pool from "../config/db.js";

dotenv.config();

export async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "Access token hết hạn hoặc không hợp lệ",
    });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);

    const userRes = await pool.query(
      `
      SELECT 
        id,
        username,
        phone,
        role,
        status,
        area,
        area_type,
        is_locked,
        locked_at,
        lock_until,
        lock_reason
      FROM users 
      WHERE id = $1
      `,
      [decoded.id],
    );

    const user = userRes.rows[0];

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Người dùng không tồn tại",
      });
    }

    if (user.is_locked || user.status === "locked") {
      let msg = "Tài khoản đã bị khóa";

      if (user.lock_until) {
        msg += ` đến ${new Date(user.lock_until).toLocaleString("vi-VN")}`;
      }

      if (user.lock_reason) {
        msg += `, lý do: ${user.lock_reason}`;
      }

      return res.status(403).json({
        success: false,
        message: msg,
      });
    }

    if (user.status !== "active") {
      return res.status(403).json({
        success: false,
        message: "Tài khoản không còn hoạt động",
      });
    }

    req.user = user;

    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Access token hết hạn",
      });
    }

    return res.status(403).json({
      success: false,
      message: "Access token không hợp lệ",
    });
  }
}

export function authenticateOptional(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) return next();

  try {
    req.user = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    next();
  } catch (err) {
    next();
  }
}

export function authorization(role = []) {
  return (req, res, next) => {
    if (!req.user || !role.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Không có quyền truy cập",
      });
    }

    next();
  };
}

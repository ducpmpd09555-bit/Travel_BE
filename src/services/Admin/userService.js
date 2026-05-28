import pool from "../../config/db.js";
import bcrypt from "bcrypt"; // Thêm thư viện bcrypt để hash mật khẩu

// ================== GET ALL USERS ==================
export const getAllUsersService = async (query) => {
  const { page = 1, limit = 10, search, status, role } = query;
  const offset = (page - 1) * limit;
  const params = [];
  const whereClauses = [];

  if (search) {
    params.push(`%${search}%`);
    whereClauses.push(
      `(username ILIKE $${params.length} OR phone ILIKE $${params.length})`,
    );
  }

  if (status) {
    params.push(status);
    whereClauses.push(`status = $${params.length}`);
  }

  if (role) {
    params.push(role);
    whereClauses.push(`role = $${params.length}`);
  }

  const whereString =
    whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

  // Get Total cho Pagination
  const countQuery = `SELECT COUNT(*) FROM users ${whereString}`;
  const totalRes = await pool.query(countQuery, params);
  const total = parseInt(totalRes.rows[0].count, 10);

  // Lấy data, vẫn loại bỏ cột password ở list để bảo mật
  params.push(limit);
  const limitIndex = params.length;
  params.push(offset);
  const offsetIndex = params.length;

  const dataQuery = `
    SELECT 
      id, username, phone, area, area_type, role, status, 
      is_locked, locked_at, lock_until, lock_reason, created_at, updated_at
    FROM users
    ${whereString}
    ORDER BY created_at DESC
    LIMIT $${limitIndex} OFFSET $${offsetIndex}
  `;

  const result = await pool.query(dataQuery, params);

  return {
    users: result.rows,
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
};

// ================== GET USER BY ID ==================
export const getUserByIdService = async (userId) => {
  const result = await pool.query(
    `
    SELECT 
      id, username, password, phone, area, area_type, role, status, 
      is_locked, locked_at, lock_until, lock_reason, created_at, updated_at
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

// ================== UPDATE USER ==================
export const updateUserService = async (userId, body) => {
  const { username, phone, role, status, area, area_type, password } = body;

  // 1. Kiểm tra người dùng có tồn tại không
  const existingUserRes = await pool.query(
    "SELECT id FROM users WHERE id = $1",
    [userId],
  );
  if (existingUserRes.rows.length === 0) {
    const err = new Error("Không tìm thấy người dùng");
    err.status = 404;
    throw err;
  }

  // 2. Kiểm tra trùng lặp Username hoặc Phone với người dùng KHÁC
  if (username || phone) {
    const duplicateCheck = await pool.query(
      `SELECT id, username, phone FROM users 
       WHERE (username = $1 OR phone = $2) AND id != $3`,
      [username || null, phone || null, userId],
    );

    if (duplicateCheck.rows.length > 0) {
      const duplicateUser = duplicateCheck.rows[0];
      if (duplicateUser.phone === phone) {
        const err = new Error("Số điện thoại đã được đăng ký bởi người khác");
        err.status = 409;
        throw err;
      }
      if (duplicateUser.username === username) {
        const err = new Error("Tên người dùng đã tồn tại");
        err.status = 409;
        throw err;
      }
    }
  }

  // 3. Xử lý hash mật khẩu nếu có truyền lên
  let hashedPassword = null;
  if (password && password.trim() !== "") {
    const saltRounds = 10;
    hashedPassword = await bcrypt.hash(password, saltRounds);
  }

  // 4. Thực thi cập nhật
  const result = await pool.query(
    `
    UPDATE users
    SET 
      username = COALESCE($1, username),
      phone = COALESCE($2, phone),
      role = COALESCE($3, role),
      status = COALESCE($4, status),
      area = COALESCE($5, area),
      area_type = COALESCE($6, area_type),
      password = COALESCE($7, password),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $8
    RETURNING id, username, phone, role, status, area, area_type, updated_at
    `,
    [username, phone, role, status, area, area_type, hashedPassword, userId],
  );

  return result.rows[0];
};

// ================== LOCK / UNLOCK USER ==================
export const lockUserService = async (
  userId,
  { is_locked, lock_until, lock_reason },
) => {
  const existingUserRes = await pool.query(
    "SELECT id FROM users WHERE id = $1",
    [userId],
  );
  if (existingUserRes.rows.length === 0) {
    const err = new Error("Không tìm thấy người dùng");
    err.status = 404;
    throw err;
  }

  let updateQuery = "";
  let params = [];

  if (is_locked) {
    // Thực hiện khóa
    updateQuery = `
      UPDATE users
      SET 
        status = 'locked',
        is_locked = TRUE,
        locked_at = CURRENT_TIMESTAMP,
        lock_until = $1,
        lock_reason = $2,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
      RETURNING id, username, status, is_locked, locked_at, lock_until, lock_reason
    `;
    params = [lock_until || null, lock_reason || null, userId];
  } else {
    // Mở khóa (Unlock)
    updateQuery = `
      UPDATE users
      SET 
        status = 'active',
        is_locked = FALSE,
        locked_at = NULL,
        lock_until = NULL,
        lock_reason = NULL,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING id, username, status, is_locked
    `;
    params = [userId];
  }

  const result = await pool.query(updateQuery, params);

  // Nếu người dùng bị khóa, revoke toàn bộ Refresh Tokens của user này
  if (is_locked) {
    await pool.query(
      "UPDATE refresh_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = $1",
      [userId],
    );
  }

  return result.rows[0];
};

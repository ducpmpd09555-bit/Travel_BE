import pool from "../../config/db.js";

// ================== ADMIN: LẤY DANH SÁCH TRÚNG THƯỞNG ==================
export const getAllSpinResultsService = async (query) => {
  const { page = 1, limit = 10, search, campaignId, rewardType } = query;
  const offset = (page - 1) * limit;
  const params = [];
  const whereClauses = [];

  // Tìm kiếm theo Tên người dùng hoặc Số điện thoại
  if (search) {
    params.push(`%${search}%`);
    whereClauses.push(
      `(u.username ILIKE $${params.length} OR u.phone ILIKE $${params.length})`,
    );
  }

  // Lọc theo Chiến dịch
  if (campaignId) {
    params.push(campaignId);
    whereClauses.push(`sr.campaign_id = $${params.length}`);
  }

  // Lọc theo Loại quà (voucher / physical)
  if (rewardType) {
    params.push(rewardType);
    whereClauses.push(`sr.reward_type = $${params.length}`);
  }

  const whereString =
    whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

  // 1. Đếm tổng số lượng để phân trang
  const countQuery = `
    SELECT COUNT(*) 
    FROM spin_results sr
    JOIN users u ON sr.user_id = u.id
    ${whereString}
  `;
  const countRes = await pool.query(countQuery, params);
  const total = parseInt(countRes.rows[0].count, 10);

  // 2. Truy vấn dữ liệu chi tiết
  params.push(limit, offset);
  const dataQuery = `
    SELECT 
      sr.id, sr.spun_at, sr.reward_type, sr.voucher_code, 
      sr.physical_status, sr.voucher_status, sr.status as result_status,
      u.username, u.phone, u.area,
      r.name AS reward_name, r.image_url,
      c.name AS campaign_name
    FROM spin_results sr
    JOIN users u ON sr.user_id = u.id
    JOIN rewards r ON sr.reward_id = r.id
    JOIN campaigns c ON sr.campaign_id = c.id
    ${whereString}
    ORDER BY sr.spun_at DESC
    LIMIT $${params.length - 1} OFFSET $${params.length}
  `;
  const result = await pool.query(dataQuery, params);

  return {
    results: result.rows,
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
};

// ================== ADMIN: XEM CHI TIẾT 1 LƯỢT TRÚNG THƯỞNG ==================
export const getSpinResultByIdService = async (id) => {
  const result = await pool.query(
    `SELECT 
      sr.*,
      u.username, u.phone, u.area, u.area_type as user_area_type,
      r.name AS reward_name, r.image_url, r.description, r.voucher_value,
      c.name AS campaign_name
    FROM spin_results sr
    JOIN users u ON sr.user_id = u.id
    JOIN rewards r ON sr.reward_id = r.id
    JOIN campaigns c ON sr.campaign_id = c.id
    WHERE sr.id = $1`,
    [id],
  );

  if (result.rows.length === 0) {
    const err = new Error("Không tìm thấy kết quả trúng thưởng");
    err.status = 404;
    throw err;
  }

  return result.rows[0];
};

// ================== ADMIN: CẬP NHẬT TRẠNG THÁI GIAO QUÀ/LIÊN HỆ ==================
export const updateSpinResultStatusService = async (id, body) => {
  const { physical_status, voucher_status, note, status } = body;

  const checkExist = await pool.query(
    "SELECT id FROM spin_results WHERE id = $1",
    [id],
  );
  if (checkExist.rows.length === 0) {
    const err = new Error("Không tìm thấy kết quả trúng thưởng");
    err.status = 404;
    throw err;
  }

  const result = await pool.query(
    `UPDATE spin_results 
     SET 
       physical_status = COALESCE($1, physical_status),
       voucher_status = COALESCE($2, voucher_status),
       note = COALESCE($3, note),
       status = COALESCE($4, status),
       updated_at = CURRENT_TIMESTAMP
     WHERE id = $5
     RETURNING *`,
    [physical_status, voucher_status, note, status, id],
  );

  return result.rows[0];
};

import pool from "../../config/db.js";

// ================== ADMIN: CREATE CAMPAIGN ==================
export const createCampaignService = async (body) => {
  const {
    name,
    slogan,
    description,
    banner_url,
    start_date,
    end_date,
    status,
  } = body;

  if (new Date(end_date) < new Date(start_date)) {
    const err = new Error("Ngày kết thúc không được nhỏ hơn ngày bắt đầu");
    err.status = 400;
    throw err;
  }

  const result = await pool.query(
    `INSERT INTO campaigns (name, slogan, description, banner_url, start_date, end_date, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      name,
      slogan,
      description,
      banner_url,
      start_date,
      end_date,
      status || "upcoming",
    ],
  );

  return result.rows[0];
};

// ================== ADMIN: GET ALL CAMPAIGNS ==================
export const getAllCampaignsService = async (query) => {
  const { page = 1, limit = 10, search, status } = query;
  const offset = (page - 1) * limit;
  const params = [];
  const whereClauses = [];

  if (search) {
    params.push(`%${search}%`);
    whereClauses.push(`name ILIKE $${params.length}`);
  }

  if (status) {
    params.push(status);
    whereClauses.push(`status = $${params.length}`);
  }

  const whereString =
    whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

  // Get total for pagination
  const countRes = await pool.query(
    `SELECT COUNT(*) FROM campaigns ${whereString}`,
    params,
  );
  const total = parseInt(countRes.rows[0].count, 10);

  // Get data
  params.push(limit, offset);
  const dataQuery = `
    SELECT * FROM campaigns 
    ${whereString} 
    ORDER BY created_at DESC 
    LIMIT $${params.length - 1} OFFSET $${params.length}
  `;
  const result = await pool.query(dataQuery, params);

  return {
    campaigns: result.rows,
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
};
export const getCampaignByIdService = async (id) => {
  const result = await pool.query("SELECT * FROM campaigns WHERE id = $1", [
    id,
  ]);

  if (result.rows.length === 0) {
    const err = new Error("Không tìm thấy chiến dịch");
    err.status = 404;
    throw err;
  }

  return result.rows[0];
};

// ================== ADMIN: UPDATE CAMPAIGN ==================
export const updateCampaignService = async (id, body) => {
  const {
    name,
    slogan,
    description,
    banner_url,
    start_date,
    end_date,
    status,
  } = body;

  // Kiểm tra tồn tại
  const checkExist = await pool.query(
    "SELECT id, start_date, end_date FROM campaigns WHERE id = $1",
    [id],
  );
  if (checkExist.rows.length === 0) {
    const err = new Error("Không tìm thấy chiến dịch");
    err.status = 404;
    throw err;
  }

  // Validate ngày tháng nếu có update
  const newStartDate = start_date || checkExist.rows[0].start_date;
  const newEndDate = end_date || checkExist.rows[0].end_date;
  if (new Date(newEndDate) < new Date(newStartDate)) {
    const err = new Error("Ngày kết thúc không được nhỏ hơn ngày bắt đầu");
    err.status = 400;
    throw err;
  }

  const result = await pool.query(
    `UPDATE campaigns 
     SET 
       name = COALESCE($1, name),
       slogan = COALESCE($2, slogan),
       description = COALESCE($3, description),
       banner_url = COALESCE($4, banner_url),
       start_date = COALESCE($5, start_date),
       end_date = COALESCE($6, end_date),
       status = COALESCE($7, status),
       updated_at = CURRENT_TIMESTAMP
     WHERE id = $8
     RETURNING *`,
    [name, slogan, description, banner_url, start_date, end_date, status, id],
  );

  return result.rows[0];
};

// ================== USER: GET ACTIVE CAMPAIGN ==================
export const getActiveCampaignService = async () => {
  // Bỏ LIMIT 1 để lấy TẤT CẢ chiến dịch đang active
  const result = await pool.query(
    `SELECT id, name, slogan, description, banner_url, start_date, end_date 
     FROM campaigns 
     WHERE status = 'active' 
       AND CURRENT_DATE >= start_date 
       AND CURRENT_DATE <= end_date
     ORDER BY created_at DESC`,
  );

  return result.rows; // Trả về toàn bộ mảng thay vì rows[0]
};

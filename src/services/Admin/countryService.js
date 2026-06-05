import pool from "../../config/db.js";

// ================= HELPER: AUTO GENERATE SLUG =================
const generateSlug = (text) => {
  if (!text) return null;
  return text
    .toString()
    .toLowerCase()
    .replace(/á|à|ả|ạ|ã|ă|ắ|ằ|ẳ|ẵ|ặ|â|ấ|ầ|ẩ|ẫ|ậ/gi, "a")
    .replace(/é|è|ẻ|ẽ|ẹ|ê|ế|ề|ể|ễ|ệ/gi, "e")
    .replace(/i|í|ì|ỉ|ĩ|ị/gi, "i")
    .replace(/ó|ò|ỏ|õ|ọ|ô|ố|ồ|ổ|ỗ|ộ|ơ|ớ|ờ|ở|ỡ|ợ/gi, "o")
    .replace(/ú|ù|ủ|ũ|ụ|ư|ứ|ừ|ử|ữ|ự/gi, "u")
    .replace(/ý|ỳ|ỷ|ỹ|ỵ/gi, "y")
    .replace(/đ/gi, "d")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-");
};

// ================= CREATE =================
export const createCountryService = async (body) => {
  const { campaign_id, name, description, image_url, status } = body;

  const campaignCheck = await pool.query(
    "SELECT id FROM campaigns WHERE id = $1",
    [campaign_id],
  );
  if (campaignCheck.rows.length === 0)
    throw { status: 404, message: "Không tìm thấy chiến dịch" };

  const duplicateCheck = await pool.query(
    "SELECT id FROM countries WHERE campaign_id = $1 AND name = $2",
    [campaign_id, name],
  );
  if (duplicateCheck.rows.length > 0)
    throw { status: 409, message: "Quốc gia này đã tồn tại trong chiến dịch" };

  // Tự động sinh slug ở backend
  const slug = generateSlug(name);

  const result = await pool.query(
    `INSERT INTO countries (campaign_id, name, slug, description, image_url, status)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [campaign_id, name, slug, description, image_url, status || "active"],
  );
  return result.rows[0];
};

// ================= GET ALL (PAGINATION) =================
export const getAllCountriesService = async (query) => {
  const { page = 1, limit = 10, search, status, campaign_id } = query;
  const offset = (page - 1) * limit;
  const params = [];
  const whereClauses = [];

  if (campaign_id) {
    params.push(campaign_id);
    whereClauses.push(`campaign_id = $${params.length}`);
  }
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

  // Đếm tổng số lượng
  const countRes = await pool.query(
    `SELECT COUNT(*) FROM countries ${whereString}`,
    params,
  );
  const total = parseInt(countRes.rows[0].count, 10);

  // Lấy data
  params.push(limit, offset);
  const dataQuery = `
    SELECT * FROM countries 
    ${whereString} 
    ORDER BY created_at DESC 
    LIMIT $${params.length - 1} OFFSET $${params.length}
  `;
  const result = await pool.query(dataQuery, params);

  return {
    countries: result.rows,
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
};

// ================= GET BY ID =================
export const getCountryByIdService = async (id) => {
  const result = await pool.query("SELECT * FROM countries WHERE id = $1", [
    id,
  ]);
  if (result.rows.length === 0)
    throw { status: 404, message: "Không tìm thấy quốc gia" };
  return result.rows[0];
};

// ================= UPDATE COUNTRY =================
export const updateCountryService = async (id, body) => {
  // Gán mặc định = null để thư viện pg không báo lỗi crash
  const {
    campaign_id = null,
    name = null,
    description = null,
    image_url = null,
    status = null,
  } = body || {};

  const slug = name ? generateSlug(name) : null;

  const result = await pool.query(
    `UPDATE countries 
     SET 
       campaign_id = COALESCE($1, campaign_id),
       name = COALESCE($2, name),
       slug = COALESCE($3, slug),
       description = COALESCE($4, description),
       image_url = COALESCE($5, image_url),
       status = COALESCE($6, status),
       updated_at = CURRENT_TIMESTAMP
     WHERE id = $7 RETURNING *`,
    [campaign_id, name, slug, description, image_url, status, id],
  );

  if (result.rows.length === 0)
    throw { status: 404, message: "Không tìm thấy quốc gia" };
  return result.rows[0];
};

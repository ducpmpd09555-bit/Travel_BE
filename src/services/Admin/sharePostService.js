import pool from "../../config/db.js";

// ================== HELPER: CHECK LINK AN TOÀN ==================
const isSafeLink = (url) => {
  if (!url) return false;
  // Chỉ tin tưởng link xuất phát từ facebook
  return /^(https?:\/\/)?(www\.)?(facebook\.com|fb\.watch|fb\.com)\/.+$/.test(
    url,
  );
};

// ================== ADMIN: LẤY DANH SÁCH HẬU KIỂM ==================
export const getAllSharePostsService = async (query) => {
  const { page = 1, limit = 10, search, status, campaign_id, user_id } = query;
  const offset = (page - 1) * limit;
  const params = [];
  const whereClauses = [];

  // TÌM KIẾM THEO TÊN USER, SĐT, HOẶC LINK
  if (search) {
    params.push(`%${search}%`);
    whereClauses.push(
      `(u.username ILIKE $${params.length} OR u.phone ILIKE $${params.length} OR sp.post_url ILIKE $${params.length})`,
    );
  }

  // BỘ LỌC
  if (status) {
    params.push(status);
    whereClauses.push(`sp.status = $${params.length}`);
  }
  if (campaign_id) {
    params.push(campaign_id);
    whereClauses.push(`sp.campaign_id = $${params.length}`);
  }
  if (user_id) {
    params.push(user_id);
    whereClauses.push(`sp.user_id = $${params.length}`);
  }

  const whereString =
    whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

  // 1. Đếm tổng số lượng (Phục vụ phân trang)
  const countQuery = `
    SELECT COUNT(*) 
    FROM share_posts sp
    JOIN users u ON sp.user_id = u.id
    JOIN campaigns c ON sp.campaign_id = c.id
    ${whereString}
  `;
  const countRes = await pool.query(countQuery, params);
  const total = parseInt(countRes.rows[0].count, 10);

  // 2. Lấy dữ liệu chi tiết
  params.push(limit, offset);
  const dataQuery = `
    SELECT 
      sp.id, sp.post_url, sp.status, sp.note, sp.created_at,
      u.id AS user_id, u.username, u.phone,
      c.id AS campaign_id, c.name AS campaign_name
    FROM share_posts sp
    JOIN users u ON sp.user_id = u.id
    JOIN campaigns c ON sp.campaign_id = c.id
    ${whereString}
    ORDER BY sp.created_at DESC
    LIMIT $${params.length - 1} OFFSET $${params.length}
  `;
  const result = await pool.query(dataQuery, params);

  // 3. Map dữ liệu lồng nhau (Nested) và thêm cờ is_safe_link
  const mappedPosts = result.rows.map((row) => ({
    id: row.id,
    post_url: row.post_url,
    status: row.status,
    note: row.note,
    created_at: row.created_at,
    is_safe_link: isSafeLink(row.post_url),
    user: {
      id: row.user_id,
      username: row.username,
      phone: row.phone,
    },
    campaign: {
      id: row.campaign_id,
      name: row.campaign_name,
    },
  }));

  return {
    share_posts: mappedPosts,
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
};

// ================== ADMIN: XEM CHI TIẾT & THỐNG KÊ CỦA 1 USER ==================
export const getUserShareStatsService = async (userId) => {
  // 1. Thống kê số liệu
  const statsRes = await pool.query(
    `
    SELECT 
      COUNT(*) as total_shares,
      COUNT(*) FILTER (WHERE status = 'auto_accepted') as valid_shares,
      COUNT(*) FILTER (WHERE status = 'invalid') as invalid_shares
    FROM share_posts
    WHERE user_id = $1
  `,
    [userId],
  );

  // 2. Lấy lịch sử chi tiết
  const listRes = await pool.query(
    `
    SELECT sp.id, sp.post_url, sp.status, sp.note, sp.created_at, c.name as campaign_name
    FROM share_posts sp
    JOIN campaigns c ON sp.campaign_id = c.id
    WHERE sp.user_id = $1
    ORDER BY sp.created_at DESC
  `,
    [userId],
  );

  const mappedList = listRes.rows.map((row) => ({
    ...row,
    is_safe_link: isSafeLink(row.post_url),
  }));

  return {
    stats: {
      total: parseInt(statsRes.rows[0].total_shares, 10),
      valid: parseInt(statsRes.rows[0].valid_shares, 10),
      invalid: parseInt(statsRes.rows[0].invalid_shares, 10),
    },
    history: mappedList,
  };
};

// ================== ADMIN: ĐÁNH DẤU VI PHẠM / HỢP LỆ ==================
export const updateSharePostStatusService = async (id, body) => {
  const { status, note } = body;

  const checkExist = await pool.query(
    "SELECT id FROM share_posts WHERE id = $1",
    [id],
  );

  if (checkExist.rows.length === 0) {
    const err = new Error("Không tìm thấy bài chia sẻ");
    err.status = 404;
    throw err;
  }

  const result = await pool.query(
    `UPDATE share_posts 
     SET 
       status = COALESCE($1, status),
       note = COALESCE($2, note),
       updated_at = CURRENT_TIMESTAMP
     WHERE id = $3
     RETURNING *`,
    [status, note, id],
  );

  return result.rows[0];
};

import pool from "../../config/db.js";

// ================= CREATE (WITH RATES TRANSACTION) =================
export const createRewardService = async (body) => {
  const {
    campaign_id,
    name,
    type,
    quantity,
    voucher_value,
    max_discount,
    description,
    image_url,
    status,
    rates, // Kỳ vọng object: { danang: 15.5, outside_danang: 84.5 }
  } = body;

  if (
    !rates ||
    rates.danang === undefined ||
    rates.outside_danang === undefined
  ) {
    throw {
      status: 400,
      message: "Thiếu cấu hình tỉ lệ trúng thưởng (rates) cho các khu vực",
    };
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1. Thêm phần quà vào bảng rewards
    const rewardRes = await client.query(
      `INSERT INTO rewards (campaign_id, name, type, quantity, remaining_quantity, voucher_value, max_discount, description, image_url, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [
        campaign_id,
        name,
        type,
        quantity,
        quantity,
        voucher_value || null,
        max_discount || null,
        description,
        image_url,
        status || "active",
      ],
    );
    const newReward = rewardRes.rows[0];

    // 2. Thêm 2 bản ghi tỉ lệ phân chia theo khu vực vào bảng reward_rates
    const rateRecords = [
      { area_type: "danang", rate: rates.danang },
      { area_type: "outside_danang", rate: rates.outside_danang },
    ];

    const rateQueries = rateRecords.map((r) => {
      return client.query(
        `INSERT INTO reward_rates (campaign_id, reward_id, area_type, rate, status)
         VALUES ($1, $2, $3, $4, 'active') RETURNING *`,
        [campaign_id, newReward.id, r.area_type, r.rate],
      );
    });
    const rateResults = await Promise.all(rateQueries);

    await client.query("COMMIT");

    return {
      ...newReward,
      rates: rateResults.map((r) => r.rows[0]),
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

// ================= GET ALL (PAGINATION & FILTERS) =================
export const getAllRewardsService = async (query) => {
  const { page = 1, limit = 10, search, type, campaign_id } = query;
  const offset = (page - 1) * limit;
  const params = [];
  const whereClauses = [];

  if (campaign_id) {
    params.push(campaign_id);
    whereClauses.push(`campaign_id = $${params.length}`);
  }
  if (type) {
    params.push(type);
    whereClauses.push(`type = $${params.length}`);
  }
  if (search) {
    params.push(`%${search}%`);
    whereClauses.push(`name ILIKE $${params.length}`);
  }

  const whereString =
    whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

  const countRes = await pool.query(
    `SELECT COUNT(*) FROM rewards ${whereString}`,
    params,
  );
  const total = parseInt(countRes.rows[0].count, 10);

  params.push(limit, offset);
  const dataQuery = `
    SELECT * FROM rewards 
    ${whereString} 
    ORDER BY created_at DESC 
    LIMIT $${params.length - 1} OFFSET $${params.length}
  `;
  const result = await pool.query(dataQuery, params);

  return {
    rewards: result.rows,
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
};

// ================= GET BY ID (WITH RATES) =================
export const getRewardByIdService = async (id) => {
  const rewardRes = await pool.query("SELECT * FROM rewards WHERE id = $1", [
    id,
  ]);
  if (rewardRes.rows.length === 0)
    throw { status: 404, message: "Không tìm thấy phần thưởng" };

  const ratesRes = await pool.query(
    "SELECT id, area_type, rate, status FROM reward_rates WHERE reward_id = $1",
    [id],
  );

  return {
    ...rewardRes.rows[0],
    rates: ratesRes.rows,
  };
};

// ================= UPDATE REWARD & RATES TRANSACTION =================
export const updateRewardService = async (id, body) => {
  const {
    name,
    type,
    quantity,
    remaining_quantity,
    voucher_value,
    max_discount,
    description,
    image_url,
    status,
    rates,
  } = body || {};

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Xử lý an toàn: Ép chuỗi rỗng "" thành null để Postgres không bị crash Data Type
    const safeVoucherValue = voucher_value === "" ? null : voucher_value;
    const safeMaxDiscount = max_discount === "" ? null : max_discount;

    // 1. Cập nhật bảng thông tin chung phần thưởng
    const rewardRes = await client.query(
      `UPDATE rewards 
       SET 
         name = COALESCE($1, name),
         type = COALESCE($2, type),
         quantity = COALESCE($3, quantity),
         remaining_quantity = COALESCE($4, remaining_quantity),
         voucher_value = $5, -- Cho phép ghi đè thành null nếu đổi loại quà
         max_discount = $6,  -- Cho phép ghi đè thành null nếu đổi loại quà
         description = COALESCE($7, description),
         image_url = COALESCE($8, image_url),
         status = COALESCE($9, status),
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $10 RETURNING *`,
      [
        name,
        type,
        quantity,
        remaining_quantity,
        safeVoucherValue, // <--- Đã được bọc an toàn
        safeMaxDiscount, // <--- Đã được bọc an toàn
        description,
        image_url,
        status,
        id,
      ],
    );

    if (rewardRes.rows.length === 0) {
      throw { status: 404, message: "Không tìm thấy phần thưởng để cập nhật" };
    }

    // 2. Cập nhật tỉ lệ (nếu có truyền lên)
    if (rates) {
      if (rates.danang !== undefined) {
        await client.query(
          "UPDATE reward_rates SET rate = $1 WHERE reward_id = $2 AND area_type = 'danang'",
          [rates.danang, id],
        );
      }
      if (rates.outside_danang !== undefined) {
        await client.query(
          "UPDATE reward_rates SET rate = $1 WHERE reward_id = $2 AND area_type = 'outside_danang'",
          [rates.outside_danang, id],
        );
      }
    }

    const finalRates = await client.query(
      "SELECT id, area_type, rate, status FROM reward_rates WHERE reward_id = $1",
      [id],
    );

    await client.query("COMMIT");

    return {
      ...rewardRes.rows[0],
      rates: finalRates.rows,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Lỗi Update Reward:", error);
    throw error;
  } finally {
    client.release();
  }
};

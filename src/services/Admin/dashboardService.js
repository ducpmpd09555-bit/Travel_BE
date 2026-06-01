import pool from "../../config/db.js";

// ======================================================================
// 1. DASHBOARD 24H (REAL-TIME HÔM NAY)
// ======================================================================
export const getDashboard24hService = async () => {
  // 1. LẤY KPI & ALERTS (Dữ liệu tổng quan trong ngày hôm nay)
  const kpiAlertQuery = `
    SELECT
      (SELECT COUNT(*) FROM users WHERE DATE(created_at AT TIME ZONE 'Asia/Ho_Chi_Minh') = DATE(NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')) AS new_users,
      (SELECT COUNT(DISTINCT user_id) FROM play_sessions WHERE DATE(created_at AT TIME ZONE 'Asia/Ho_Chi_Minh') = DATE(NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')) AS active_players,
      (SELECT COUNT(*) FROM play_sessions WHERE DATE(created_at AT TIME ZONE 'Asia/Ho_Chi_Minh') = DATE(NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')) AS total_plays,
      (SELECT COUNT(*) FROM share_posts WHERE DATE(created_at AT TIME ZONE 'Asia/Ho_Chi_Minh') = DATE(NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')) AS total_shares,
      (SELECT COUNT(*) FROM spin_results WHERE DATE(spun_at AT TIME ZONE 'Asia/Ho_Chi_Minh') = DATE(NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')) AS gifts_won,
      
      (SELECT COUNT(*) FROM rewards WHERE remaining_quantity < 10 AND status = 'active') AS out_of_stock_rewards,
      (SELECT COUNT(*) FROM spin_results WHERE physical_status = 'pending_contact') AS pending_physical_gifts,
      (SELECT COUNT(*) FROM share_posts WHERE status = 'invalid' AND DATE(updated_at AT TIME ZONE 'Asia/Ho_Chi_Minh') = DATE(NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')) AS fake_shares_detected
  `;

  // 2. KHUNG GIỜ TIME SERIES TRONG NGÀY (Từ 0h00 đến 23h59)
  const timeSeries = `
    SELECT generate_series(
      date_trunc('day', NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh'),
      date_trunc('day', NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh') + INTERVAL '23 hours',
      '1 hour'::interval
    ) AS hour_slot
  `;

  // 3. LƯỢT CHƠI THEO GIỜ
  const playsByHourQuery = `
    WITH hours AS (${timeSeries})
    SELECT TO_CHAR(h.hour_slot, 'HH24:00') AS hour, COUNT(ps.id) AS play_count
    FROM hours h
    LEFT JOIN play_sessions ps 
      ON EXTRACT(HOUR FROM ps.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh') = EXTRACT(HOUR FROM h.hour_slot)
      AND DATE(ps.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh') = DATE(NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')
    GROUP BY h.hour_slot ORDER BY h.hour_slot ASC
  `;

  // 4. LƯỢT TRÚNG QUÀ THEO GIỜ
  const spinsByHourQuery = `
    WITH hours AS (${timeSeries})
    SELECT TO_CHAR(h.hour_slot, 'HH24:00') AS hour, COUNT(sr.id) AS spin_count
    FROM hours h
    LEFT JOIN spin_results sr 
      ON EXTRACT(HOUR FROM sr.spun_at AT TIME ZONE 'Asia/Ho_Chi_Minh') = EXTRACT(HOUR FROM h.hour_slot)
      AND DATE(sr.spun_at AT TIME ZONE 'Asia/Ho_Chi_Minh') = DATE(NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')
    GROUP BY h.hour_slot ORDER BY h.hour_slot ASC
  `;

  // 5. TOP ĐỊA ĐIỂM HOT NHẤT HÔM NAY (Join qua session_answers để tìm location)
  const topLocationsQuery = `
    SELECT l.id, l.name, l.image_url, COUNT(DISTINCT ps.id) AS plays
    FROM play_sessions ps
    JOIN session_answers sa ON ps.id = sa.play_session_id
    JOIN questions q ON sa.question_id = q.id
    JOIN locations l ON q.location_id = l.id
    WHERE DATE(ps.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh') = DATE(NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')
    GROUP BY l.id, l.name, l.image_url
    ORDER BY plays DESC LIMIT 5
  `;

  const [kpiAlertRes, playsRes, spinsRes, topLocationsRes] = await Promise.all([
    pool.query(kpiAlertQuery),
    pool.query(playsByHourQuery),
    pool.query(spinsByHourQuery),
    pool.query(topLocationsQuery),
  ]);

  const kpiAlertData = kpiAlertRes.rows[0];

  return {
    kpi: {
      new_users: Number(kpiAlertData.new_users),
      active_players: Number(kpiAlertData.active_players),
      total_plays: Number(kpiAlertData.total_plays),
      total_shares: Number(kpiAlertData.total_shares),
      gifts_won: Number(kpiAlertData.gifts_won),
    },
    alerts: {
      out_of_stock_rewards: Number(kpiAlertData.out_of_stock_rewards),
      pending_physical_gifts: Number(kpiAlertData.pending_physical_gifts),
      fake_shares_detected: Number(kpiAlertData.fake_shares_detected),
    },
    plays_by_hour: playsRes.rows.map((r) => ({
      hour: r.hour,
      count: Number(r.play_count),
    })),
    spins_by_hour: spinsRes.rows.map((r) => ({
      hour: r.hour,
      count: Number(r.spin_count),
    })),
    top_locations: topLocationsRes.rows.map((r) => ({
      ...r,
      plays: Number(r.plays),
    })),
  };
};

// ======================================================================
// 2. BÁO CÁO TỔNG QUAN (REPORT THEO KHOẢNG THỜI GIAN)
// ======================================================================
export const getReportService = async ({ from_date, to_date, type }) => {
  let intervalType = "1 day";
  let groupFormat = "YYYY-MM-DD";

  if (type === "week") {
    intervalType = "1 week";
    groupFormat = "IYYY-IW";
  } else if (type === "month") {
    intervalType = "1 month";
    groupFormat = "YYYY-MM";
  } else if (type === "year") {
    intervalType = "1 year";
    groupFormat = "YYYY";
  }

  const timeSeriesCTE = `WITH time_series AS (SELECT generate_series($1::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh', $2::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh', '${intervalType}'::interval) AS slot)`;

  // Biểu đồ: Người dùng mới
  const usersQuery = `${timeSeriesCTE} 
    SELECT TO_CHAR(ts.slot, '${groupFormat}') AS label, COUNT(u.id) AS users 
    FROM time_series ts 
    LEFT JOIN users u ON TO_CHAR(u.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ho_Chi_Minh', '${groupFormat}') = TO_CHAR(ts.slot, '${groupFormat}') 
    GROUP BY ts.slot ORDER BY ts.slot`;

  // Biểu đồ: Lượt Chơi vs Lượt Share (Funnel Tương tác)
  const engagementQuery = `${timeSeriesCTE} 
    SELECT 
      TO_CHAR(ts.slot, '${groupFormat}') AS label, 
      COUNT(DISTINCT ps.id) AS plays,
      COUNT(DISTINCT sp.id) AS shares
    FROM time_series ts 
    LEFT JOIN play_sessions ps ON TO_CHAR(ps.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ho_Chi_Minh', '${groupFormat}') = TO_CHAR(ts.slot, '${groupFormat}')
    LEFT JOIN share_posts sp ON TO_CHAR(sp.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ho_Chi_Minh', '${groupFormat}') = TO_CHAR(ts.slot, '${groupFormat}')
    GROUP BY ts.slot ORDER BY ts.slot`;

  // Thống kê: Trạng thái trả lời câu hỏi (Tỉ lệ rớt game)
  const gameQualityQuery = `
    SELECT status, COUNT(id) as count 
    FROM play_sessions 
    WHERE created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ho_Chi_Minh' BETWEEN $1::timestamp AND $2::timestamp
    GROUP BY status
  `;

  // Thống kê: Cơ cấu phần thưởng đã phát ra
  const rewardDistributionQuery = `
    SELECT r.id, r.name, r.type, COUNT(sr.id) as total_won
    FROM rewards r
    JOIN spin_results sr ON r.id = sr.reward_id
    WHERE sr.spun_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ho_Chi_Minh' BETWEEN $1::timestamp AND $2::timestamp
    GROUP BY r.id, r.name, r.type
    ORDER BY total_won DESC
  `;

  // Thống kê: Trạng thái sử dụng Voucher
  const voucherConversionQuery = `
    SELECT voucher_status, COUNT(id) as count
    FROM spin_results
    WHERE reward_type = 'voucher' 
      AND spun_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ho_Chi_Minh' BETWEEN $1::timestamp AND $2::timestamp
    GROUP BY voucher_status
  `;

  const [usersRes, engagementRes, gameQualityRes, rewardsRes, voucherRes] =
    await Promise.all([
      pool.query(usersQuery, [from_date, to_date]),
      pool.query(engagementQuery, [from_date, to_date]),
      pool.query(gameQualityQuery, [from_date, to_date]),
      pool.query(rewardDistributionQuery, [from_date, to_date]),
      pool.query(voucherConversionQuery, [from_date, to_date]),
    ]);

  return {
    users_growth: usersRes.rows.map((r) => ({
      label: r.label,
      users: Number(r.users),
    })),
    engagement_funnel: engagementRes.rows.map((r) => ({
      label: r.label,
      plays: Number(r.plays),
      shares: Number(r.shares),
    })),
    game_quality: gameQualityRes.rows.map((r) => ({
      status: r.status,
      count: Number(r.count),
    })),
    reward_distribution: rewardsRes.rows.map((r) => ({
      id: r.id,
      name: r.name,
      type: r.type,
      total_won: Number(r.total_won),
    })),
    voucher_conversion: voucherRes.rows.map((r) => ({
      status: r.voucher_status,
      count: Number(r.count),
    })),
  };
};

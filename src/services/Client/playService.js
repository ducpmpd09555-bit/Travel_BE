import pool from "../../config/db.js";
import cron from "node-cron";

// ======================================================================
// API 1: KHỞI TẠO LƯỢT CHƠI (CHỐNG LỖI 500 RACE CONDITION)
// ======================================================================
const getRandomReward = (rewards) => {
  // Dùng parseFloat để biến chuỗi "50.000" thành số thực 50.0
  const totalWeight = rewards.reduce(
    (sum, item) => sum + parseFloat(item.rate),
    0,
  );
  let random = Math.random() * totalWeight;

  for (const reward of rewards) {
    random -= parseFloat(reward.rate);
    if (random <= 0) return reward;
  }
  return null;
};
export const initPlaySessionService = async (
  userId,
  locationId,
  campaignId,
) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    let dailyLimitRes = await client.query(
      `INSERT INTO daily_play_limits (user_id, campaign_id, play_date, total_available_plays, used_play_count, share_bonus_count) 
       VALUES ($1, $2, CURRENT_DATE, 1, 0, 0)
       ON CONFLICT (user_id, campaign_id, play_date) 
       DO UPDATE SET updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [userId, campaignId],
    );

    const limitData = dailyLimitRes.rows[0];

    const activeSession = await client.query(
      `SELECT id FROM play_sessions 
       WHERE daily_play_limit_id = $1 AND user_id = $2 AND status = 'playing' 
       LIMIT 1`,
      [limitData.id, userId],
    );

    if (activeSession.rows.length > 0) {
      await client.query("COMMIT");
      return { sessionId: activeSession.rows[0].id };
    }

    if (limitData.used_play_count >= limitData.total_available_plays) {
      if (limitData.share_bonus_count === 0) {
        throw new Error("OUT_OF_PLAYS_NEED_SHARE");
      }
      throw new Error("OUT_OF_PLAYS_COME_TOMORROW");
    }

    await client.query(
      `UPDATE daily_play_limits SET used_play_count = used_play_count + 1 WHERE id = $1`,
      [limitData.id],
    );

    const sessionRes = await client.query(
      `INSERT INTO play_sessions (daily_play_limit_id, user_id, campaign_id, status) 
       VALUES ($1, $2, $3, 'playing') RETURNING id`,
      [limitData.id, userId, campaignId],
    );

    await client.query("COMMIT");
    return { sessionId: sessionRes.rows[0].id };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

// ======================================================================
// API 2: LẤY CÂU HỎI (GET /api/play/questions/:locationId)
// ======================================================================
export const getQuestionsForUserService = async (locationId, category) => {
  const questionsRes = await pool.query(
    `SELECT id, question_text, category 
     FROM questions 
     WHERE location_id = $1 AND category = $2 AND status = 'active'
     ORDER BY RANDOM() LIMIT 2`,
    [locationId, category],
  );

  if (questionsRes.rows.length === 0) return [];
  const questions = questionsRes.rows;
  const questionIds = questions.map((q) => q.id);

  const answersRes = await pool.query(
    `SELECT id, question_id, option_label, answer_text 
     FROM answers 
     WHERE question_id = ANY($1) 
     ORDER BY option_label ASC`,
    [questionIds],
  );

  return questions.map((q) => ({
    ...q,
    answers: answersRes.rows
      .filter((a) => a.question_id === q.id)
      .map((a) => ({
        id: a.id,
        option_label: a.option_label,
        answer_text: a.answer_text,
      })),
  }));
};

// ======================================================================
// API 3: NỘP BÀI VÀ CHẤM ĐIỂM (CÓ TRẢ VỀ GIẢI THÍCH)
// ======================================================================
export const submitAnswersService = async (userId, sessionId, userAnswers) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const sessionRes = await client.query(
      `SELECT status FROM play_sessions WHERE id = $1 AND user_id = $2 FOR UPDATE`,
      [sessionId, userId],
    );

    if (sessionRes.rows.length === 0) throw new Error("SESSION_NOT_FOUND");
    if (sessionRes.rows[0].status !== "playing")
      throw new Error("SESSION_ALREADY_SUBMITTED");

    const questionIds = userAnswers.map((a) => a.question_id);
    const correctAnswersRes = await client.query(
      `SELECT a.question_id, a.id as correct_answer_id, q.explanation 
       FROM answers a
       JOIN questions q ON a.question_id = q.id
       WHERE a.question_id = ANY($1) AND a.is_correct = true`,
      [questionIds],
    );

    const correctMap = {};
    const explanationMap = {};
    correctAnswersRes.rows.forEach((r) => {
      correctMap[r.question_id] = r.correct_answer_id;
      explanationMap[r.question_id] = r.explanation;
    });

    let correctCount = 0;
    let wrongCount = 0;
    const sessionAnswersData = [];
    const details = [];

    for (const ans of userAnswers) {
      const isCorrect = correctMap[ans.question_id] === ans.answer_id;
      if (isCorrect) correctCount++;
      else wrongCount++;

      sessionAnswersData.push([
        sessionId,
        ans.question_id,
        ans.answer_id,
        isCorrect,
      ]);

      details.push({
        question_id: ans.question_id,
        selected_answer_id: ans.answer_id,
        correct_answer_id: correctMap[ans.question_id],
        is_correct: isCorrect,
        explanation: explanationMap[ans.question_id],
      });
    }

    for (const data of sessionAnswersData) {
      await client.query(
        `INSERT INTO session_answers (play_session_id, question_id, selected_answer_id, is_correct) 
         VALUES ($1, $2, $3, $4)`,
        data,
      );
    }

    const isPassed = correctCount >= 4;
    const finalStatus = isPassed ? "completed" : "failed";

    await client.query(
      `UPDATE play_sessions 
       SET status = $1, total_questions = $2, correct_answers = $3, wrong_answers = $4, is_eligible_spin = $5, completed_at = CURRENT_TIMESTAMP
       WHERE id = $6`,
      [
        finalStatus,
        userAnswers.length,
        correctCount,
        wrongCount,
        isPassed,
        sessionId,
      ],
    );

    await client.query("COMMIT");
    return { correctCount, wrongCount, isPassed, details };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

// ======================================================================
// API 4: SHARE NHẬN THÊM LƯỢT
// ======================================================================
export const submitShareLinkService = async (userId, campaignId, postUrl) => {
  const isValidUrl =
    /^(https?:\/\/)?(www\.)?(facebook\.com|fb\.watch|fb\.com)\/.+$/.test(
      postUrl,
    );
  if (!isValidUrl) throw new Error("INVALID_FB_URL");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const dailyLimit = await client.query(
      `SELECT id, share_bonus_count FROM daily_play_limits 
       WHERE user_id = $1 AND campaign_id = $2 AND play_date = CURRENT_DATE FOR UPDATE`,
      [userId, campaignId],
    );

    if (dailyLimit.rows.length === 0) throw new Error("MUST_PLAY_BEFORE_SHARE");
    if (dailyLimit.rows[0].share_bonus_count >= 1)
      throw new Error("ALREADY_SHARED_TODAY");

    const limitId = dailyLimit.rows[0].id;

    await client.query(
      `INSERT INTO share_posts (user_id, campaign_id, daily_play_limit_id, post_url, platform, status)
       VALUES ($1, $2, $3, $4, 'facebook', 'auto_accepted')`,
      [userId, campaignId, limitId, postUrl],
    );

    await client.query(
      `UPDATE daily_play_limits 
       SET share_bonus_count = 1, 
           total_available_plays = total_available_plays + 1, 
           is_share = TRUE, 
           is_post_submitted = TRUE,
           post_submitted_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [limitId],
    );

    await client.query("COMMIT");
    return { success: true, message: "Đã cộng thêm 1 lượt giải đố!" };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

// ======================================================================
// API 5: LẤY LỊCH SỬ CHƠI
// ======================================================================
export const getPlayHistoryService = async (userId, campaignId) => {
  let query = `SELECT id, status, total_questions, correct_answers, wrong_answers, is_eligible_spin, completed_at, created_at 
               FROM play_sessions WHERE user_id = $1`;
  let params = [userId];

  if (campaignId && !isNaN(campaignId)) {
    query += ` AND campaign_id = $2`;
    params.push(campaignId);
  }
  query += ` ORDER BY created_at DESC`;

  const result = await pool.query(query, params);
  return result.rows;
};

// ======================================================================
// API 6: LẤY DANH SÁCH QUÀ (TÚI ĐỒ)
// ======================================================================
export const getUserRewardsService = async (userId, campaignId) => {
  let query = `SELECT sr.id as result_id, sr.reward_type, sr.voucher_code, sr.voucher_status, sr.physical_status, sr.spun_at, 
                      r.name as reward_name, r.image_url, r.description 
               FROM spin_results sr
               JOIN rewards r ON sr.reward_id = r.id
               WHERE sr.user_id = $1`;
  let params = [userId];

  if (campaignId && !isNaN(campaignId)) {
    query += ` AND sr.campaign_id = $2`;
    params.push(campaignId);
  }
  query += ` ORDER BY sr.spun_at DESC`;

  const result = await pool.query(query, params);
  return result.rows;
};

// ======================================================================
// API 7: LƯU KẾT QUẢ VÒNG QUAY (ĐÃ FIX LỖI AREA_TYPE)
// ======================================================================
export const saveSpinResultService = async (userId, sessionId, campaignId) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1. KIỂM TRA ĐIỀU KIỆN QUAY & KHÓA PHIÊN (Chống spam click)
    const sessionRes = await client.query(
      `SELECT is_eligible_spin FROM play_sessions WHERE id = $1 AND user_id = $2 FOR UPDATE`,
      [sessionId, userId],
    );
    if (sessionRes.rows.length === 0) throw new Error("SESSION_NOT_FOUND");
    if (!sessionRes.rows[0].is_eligible_spin)
      throw new Error("ALREADY_SPUN_OR_NOT_ELIGIBLE");

    // 2. LẤY KHU VỰC CỦA USER
    const userRes = await client.query(
      `SELECT area_type FROM users WHERE id = $1`,
      [userId],
    );
    const userAreaType = userRes.rows[0]?.area_type || "outside_danang";

    // 3. LẤY DANH SÁCH QUÀ CÒN HÀNG VÀ CÓ RATE
    // Đã xóa điều kiện r.type != 'no_reward' vì không dùng nữa
    const availableRewardsRes = await client.query(
      `SELECT r.id, r.type, r.voucher_value, rr.rate 
       FROM rewards r
       JOIN reward_rates rr ON r.id = rr.reward_id
       WHERE rr.area_type = $1 
         AND r.campaign_id = $2
         AND r.status = 'active'
         AND r.remaining_quantity > 0 
         AND rr.rate > 0`,
      [userAreaType, campaignId],
    );

    // XỬ LÝ KHI KHO HẾT SẠCH QUÀ
    if (availableRewardsRes.rows.length === 0) {
      throw new Error("OUT_OF_REWARDS");
    }

    // 4. LOGIC QUAY THƯỞNG & XỬ LÝ RACE CONDITION
    const selectedReward = getRandomReward(availableRewardsRes.rows);

    if (!selectedReward) {
      throw new Error("OUT_OF_REWARDS");
    }

    // KHÓA MÓN QUÀ VỪA TRÚNG ĐỂ CHECK LẠI KHO TRƯỚC KHI CHỐT
    const lockedRewardRes = await client.query(
      `SELECT remaining_quantity FROM rewards WHERE id = $1 FOR UPDATE`,
      [selectedReward.id],
    );

    if (lockedRewardRes.rows[0].remaining_quantity <= 0) {
      // Bị user khác giành mất món cuối cùng trong tích tắc
      // Báo lỗi để Frontend nhắc user bấm quay lại (vì chưa tới bước tước lượt quay nên user k bị thiệt)
      throw new Error("REWARD_OUT_OF_STOCK_TRY_AGAIN");
    }

    const finalReward = selectedReward;

    // 5. XỬ LÝ LOGIC LOẠI QUÀ
    const typeOfReward = finalReward.type;
    const valueOfReward = finalReward.voucher_value || 0;
    let voucherCode = null;

    if (typeOfReward === "voucher") {
      voucherCode = `SUMMER26-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    }

    // 6. GHI LỊCH SỬ QUAY VÀO DB
    await client.query(
      `INSERT INTO spin_results (
        play_session_id, user_id, campaign_id, reward_id, 
        area_type, reward_type, voucher_code, voucher_value, 
        voucher_status, physical_status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        sessionId,
        userId,
        campaignId,
        finalReward.id,
        userAreaType,
        typeOfReward,
        voucherCode,
        valueOfReward,
        typeOfReward === "voucher" ? "assigned" : null,
        typeOfReward === "physical" ? "pending_contact" : null,
      ],
    );

    // 7. TRỪ KHO QUÀ (Luôn trừ vì chắc chắn trúng quà thật)
    await client.query(
      `UPDATE rewards SET remaining_quantity = remaining_quantity - 1 WHERE id = $1`,
      [finalReward.id],
    );

    // 8. KHÓA PHIÊN CHƠI (Tước cờ quay)
    await client.query(
      `UPDATE play_sessions SET is_eligible_spin = false WHERE id = $1`,
      [sessionId],
    );

    await client.query("COMMIT");
    return {
      success: true,
      rewardId: finalReward.id,
      rewardType: typeOfReward,
      voucherCode,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("🔥 LỖI SQL TẠI API SPIN:", error.message);
    throw error;
  } finally {
    client.release();
  }
};
export const getLocationProgressService = async (userId, campaignId) => {
  const query = `
    SELECT 
      l.id AS location_id,
      l.country_id,
      l.name,
      l.image_url,
      l.description,
      l.lat,
      l.lng,
      l.status AS location_status,
      COUNT(DISTINCT ps.id) AS total_attempts,
      MAX(ps.correct_answers) AS best_score,
      CASE 
        WHEN MAX(CASE WHEN ps.is_eligible_spin = true THEN 1 ELSE 0 END) = 1 THEN 'passed'
        WHEN COUNT(DISTINCT ps.id) > 0 THEN 'failed'
        ELSE 'unexplored'
      END as status
    FROM locations l
    JOIN countries c ON l.country_id = c.id
    LEFT JOIN questions q ON q.location_id = l.id
    LEFT JOIN session_answers sa ON sa.question_id = q.id
    LEFT JOIN play_sessions ps ON sa.play_session_id = ps.id 
          AND ps.user_id = $1 
          AND ps.status IN ('completed', 'failed')
    WHERE c.campaign_id = $2
    GROUP BY l.id, l.country_id, l.name, l.image_url, l.description, l.lat, l.lng, l.status
    -- THAY ĐỔI Ở ĐÂY: Ưu tiên 'active' lên số 0 (đứng đầu), các trạng thái khác số 1 (đứng sau)
    ORDER BY 
      CASE WHEN l.status = 'active' THEN 0 ELSE 1 END ASC,
      l.id ASC;
  `;
  const result = await pool.query(query, [userId, campaignId]);
  return result.rows;
};

// ======================================================================
// CRON JOB: TỰ ĐỘNG RESET LƯỢT CHƠI LÚC 0H00 MỖI NGÀY
// ======================================================================
cron.schedule("0 0 * * *", async () => {
  const client = await pool.connect();
  try {
    console.log(
      "⏳ [CRON] Đang chạy trình dọn dẹp và reset lượt chơi hàng ngày...",
    );

    // Reset toàn bộ số lượt đã dùng và số lượt share về 0 cho ngày mới
    await client.query(`
      UPDATE daily_play_limits 
      SET used_play_count = 0, 
          share_bonus_count = 0, 
          is_share = false, 
          is_post_submitted = false
      WHERE play_date = CURRENT_DATE
    `);

    console.log("✅ [CRON] Đã reset lượt chơi thành công cho toàn bộ User!");
  } catch (error) {
    console.error("❌ [CRON] Lỗi khi reset lượt chơi:", error.message);
  } finally {
    client.release();
  }
});

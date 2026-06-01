import pool from "../config/db.js";
import bcrypt from "bcrypt";

const initTables = async () => {
  // 1. LẤY CLIENT TỪ POOL ĐỂ BẮT ĐẦU TRANSACTION
  const client = await pool.connect();

  try {
    // 2. KHỞI TẠO EXTENSION
    try {
      await client.query(
        "CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA public;",
      );
      console.log("✅ Đã bật extension unaccent thành công!");
    } catch (extErr) {
      console.error(
        "⚠️ Cảnh báo: Không thể tự động tạo extension unaccent. Bạn có thể cần set quyền superuser.",
        extErr.message,
      );
    }

    // 3. BẮT ĐẦU TRANSACTION
    await client.query("BEGIN");
    console.log("⏳ Bắt đầu khởi tạo cấu trúc Database Travel Minigame...");

    // ================== USERS ==================
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(150) NOT NULL UNIQUE,
        phone VARCHAR(20) UNIQUE,
        password VARCHAR(255) NOT NULL,
        area VARCHAR(150),
        area_type VARCHAR(30) DEFAULT 'outside_danang'
          CHECK (area_type IN ('danang', 'outside_danang')),
        role VARCHAR(20) DEFAULT 'user'
          CHECK (role IN ('user', 'admin')),
        status VARCHAR(20) DEFAULT 'active'
          CHECK (status IN ('active', 'locked', 'inactive')),
        is_locked BOOLEAN DEFAULT FALSE,
        locked_at TIMESTAMP,
        lock_until TIMESTAMP,
        lock_reason TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // ================== REFRESH TOKENS ==================
    await client.query(`
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        token TEXT NOT NULL UNIQUE,
        expired_at TIMESTAMP NOT NULL,
        revoked_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // ================== CAMPAIGNS ==================
    await client.query(`
      CREATE TABLE IF NOT EXISTS campaigns (
        id SERIAL PRIMARY KEY,
        name VARCHAR(200) NOT NULL,
        slogan VARCHAR(255),
        description TEXT,
        banner_url TEXT,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        status VARCHAR(20) DEFAULT 'upcoming'
          CHECK (status IN ('upcoming', 'active', 'paused', 'ended')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CHECK (end_date >= start_date)
      );
    `);

    // ================== COUNTRIES ==================
    await client.query(`
      CREATE TABLE IF NOT EXISTS countries (
        id SERIAL PRIMARY KEY,
        campaign_id INTEGER REFERENCES campaigns(id) ON DELETE CASCADE,
        name VARCHAR(150) NOT NULL,
        slug VARCHAR(150),
        description TEXT,
        image_url TEXT,
        status VARCHAR(20) DEFAULT 'active'
          CHECK (status IN ('active', 'inactive')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (campaign_id, name),
        UNIQUE (campaign_id, slug)
      );
    `);

    // ================== LOCATIONS ==================
    await client.query(`
      CREATE TABLE IF NOT EXISTS locations (
        id SERIAL PRIMARY KEY,
        country_id INTEGER REFERENCES countries(id) ON DELETE CASCADE,
        name VARCHAR(200) NOT NULL,
        slug VARCHAR(200),
        description TEXT,
        image_url TEXT,
        map_url TEXT,
        lat NUMERIC(10, 7),
        lng NUMERIC(10, 7),
        status VARCHAR(20) DEFAULT 'active'
          CHECK (status IN ('active', 'inactive')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (country_id, name),
        UNIQUE (country_id, slug)
      );
    `);

    // ================== QUESTIONS ==================
    await client.query(`
      CREATE TABLE IF NOT EXISTS questions (
        id SERIAL PRIMARY KEY,
        location_id INTEGER REFERENCES locations(id) ON DELETE CASCADE,
        question_text TEXT NOT NULL,
        category VARCHAR(100),
        explanation TEXT,
        status VARCHAR(20) DEFAULT 'active'
          CHECK (status IN ('active', 'inactive')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // ================== ANSWERS ==================
    await client.query(`
      CREATE TABLE IF NOT EXISTS answers (
        id SERIAL PRIMARY KEY,
        question_id INTEGER REFERENCES questions(id) ON DELETE CASCADE,
        option_label CHAR(1) NOT NULL
          CHECK (option_label IN ('A', 'B', 'C', 'D')),
        answer_text TEXT NOT NULL,
        is_correct BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (question_id, option_label)
      );
    `);

    // ================== DAILY PLAY LIMITS ==================
    await client.query(`
      CREATE TABLE IF NOT EXISTS daily_play_limits (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        campaign_id INTEGER REFERENCES campaigns(id) ON DELETE CASCADE,
        play_date DATE DEFAULT CURRENT_DATE,
        total_available_plays INTEGER DEFAULT 1,
        used_play_count INTEGER DEFAULT 0,
        share_bonus_count INTEGER DEFAULT 0,
        has_spun BOOLEAN DEFAULT FALSE,
        is_share BOOLEAN DEFAULT FALSE,
        is_post_submitted BOOLEAN DEFAULT FALSE,
        is_share_bonus_claimed BOOLEAN DEFAULT FALSE,
        share_clicked_at TIMESTAMP,
        post_submitted_at TIMESTAMP,
        bonus_claimed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (user_id, campaign_id, play_date),
        CHECK (total_available_plays >= 1),
        CHECK (used_play_count >= 0),
        CHECK (used_play_count <= total_available_plays),
        CHECK (share_bonus_count >= 0 AND share_bonus_count <= 1)
      );
    `);

    // ================== PLAY SESSIONS ==================
    await client.query(`
      CREATE TABLE IF NOT EXISTS play_sessions (
        id SERIAL PRIMARY KEY,
        daily_play_limit_id INTEGER REFERENCES daily_play_limits(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        campaign_id INTEGER REFERENCES campaigns(id) ON DELETE CASCADE,
        country_id INTEGER REFERENCES countries(id) ON DELETE NO ACTION,
        category_played VARCHAR(100),
        play_type VARCHAR(30) DEFAULT 'main'
          CHECK (play_type IN ('main', 'share_bonus')),
        status VARCHAR(30) DEFAULT 'playing'
          CHECK (status IN ('playing', 'completed', 'failed', 'cancelled')),
        total_questions INTEGER DEFAULT 0,
        correct_answers INTEGER DEFAULT 0,
        wrong_answers INTEGER DEFAULT 0,
        is_eligible_spin BOOLEAN DEFAULT FALSE,
        started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CHECK (total_questions >= 0),
        CHECK (correct_answers >= 0),
        CHECK (wrong_answers >= 0)
      );
    `);

    // ================== SESSION ANSWERS ==================
    await client.query(`
      CREATE TABLE IF NOT EXISTS session_answers (
        id SERIAL PRIMARY KEY,
        play_session_id INTEGER REFERENCES play_sessions(id) ON DELETE CASCADE,
        question_id INTEGER REFERENCES questions(id) ON DELETE CASCADE,
        selected_answer_id INTEGER REFERENCES answers(id) ON DELETE CASCADE,
        is_correct BOOLEAN NOT NULL,
        answered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (play_session_id, question_id)
      );
    `);

    // ================== SHARE POSTS ==================
    await client.query(`
      CREATE TABLE IF NOT EXISTS share_posts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        campaign_id INTEGER REFERENCES campaigns(id) ON DELETE CASCADE,
        daily_play_limit_id INTEGER REFERENCES daily_play_limits(id) ON DELETE CASCADE,
        post_url TEXT NOT NULL,
        platform VARCHAR(30) DEFAULT 'facebook'
          CHECK (platform IN ('facebook', 'zalo', 'tiktok', 'other')),
        status VARCHAR(30) DEFAULT 'auto_accepted'
          CHECK (status IN ('auto_accepted', 'invalid', 'cancelled')),
        note TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (user_id, campaign_id, daily_play_limit_id),
        UNIQUE (campaign_id, post_url)
      );
    `);

    // ================== REWARDS ==================
    await client.query(`
      CREATE TABLE IF NOT EXISTS rewards (
        id SERIAL PRIMARY KEY,
        campaign_id INTEGER REFERENCES campaigns(id) ON DELETE CASCADE,
        name VARCHAR(200) NOT NULL,
        type VARCHAR(30) NOT NULL
          CHECK (type IN ('voucher', 'physical')),
        quantity INTEGER,
        remaining_quantity INTEGER,
        voucher_value NUMERIC(12,2),
        max_discount NUMERIC(12,2),
        description TEXT,
        image_url TEXT,
        status VARCHAR(20) DEFAULT 'active'
          CHECK (status IN ('active', 'inactive', 'out_of_stock', 'cancelled')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CHECK (quantity IS NULL OR quantity >= 0),
        CHECK (remaining_quantity IS NULL OR remaining_quantity >= 0)
      );
    `);

    // ================== REWARD RATES ==================
    await client.query(`
      CREATE TABLE IF NOT EXISTS reward_rates (
        id SERIAL PRIMARY KEY,
        campaign_id INTEGER REFERENCES campaigns(id) ON DELETE CASCADE,
        reward_id INTEGER REFERENCES rewards(id) ON DELETE CASCADE,
        area_type VARCHAR(30) NOT NULL
          CHECK (area_type IN ('danang', 'outside_danang')),
        rate NUMERIC(6,3) NOT NULL
          CHECK (rate >= 0 AND rate <= 100),
        status VARCHAR(20) DEFAULT 'active'
          CHECK (status IN ('active', 'inactive')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (reward_id, area_type)
      );
    `);

    // ================== SPIN RESULTS ==================
    await client.query(`
      CREATE TABLE IF NOT EXISTS spin_results (
        id SERIAL PRIMARY KEY,
        play_session_id INTEGER UNIQUE REFERENCES play_sessions(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        campaign_id INTEGER REFERENCES campaigns(id) ON DELETE CASCADE,
        reward_id INTEGER REFERENCES rewards(id) ON DELETE RESTRICT,
        area_type VARCHAR(30) NOT NULL
          CHECK (area_type IN ('danang', 'outside_danang')),
        reward_type VARCHAR(30) NOT NULL
          CHECK (reward_type IN ('voucher', 'physical')),
        voucher_code VARCHAR(100),
        voucher_value NUMERIC(12,2),
        voucher_status VARCHAR(30)
          CHECK (
            voucher_status IS NULL
            OR voucher_status IN ('assigned', 'used', 'expired', 'cancelled')
          ),
        physical_status VARCHAR(30)
          CHECK (
            physical_status IS NULL
            OR physical_status IN ('pending_contact', 'contacted', 'received', 'cancelled')
          ),
        status VARCHAR(30) DEFAULT 'valid'
          CHECK (status IN ('valid', 'cancelled')),
        note TEXT,
        spun_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // ================== INDEXES ==================
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);`,
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);`,
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);`,
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_users_is_locked ON users(is_locked);`,
    );

    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);`,
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token);`,
    );

    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);`,
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_countries_campaign ON countries(campaign_id);`,
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_locations_country ON locations(country_id);`,
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_questions_location ON questions(location_id);`,
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_answers_question ON answers(question_id);`,
    );

    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_daily_play_user_date ON daily_play_limits(user_id, campaign_id, play_date);`,
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_play_sessions_user_campaign ON play_sessions(user_id, campaign_id);`,
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_session_answers_session ON session_answers(play_session_id);`,
    );

    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_share_posts_user_campaign ON share_posts(user_id, campaign_id);`,
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_share_posts_post_url ON share_posts(post_url);`,
    );

    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_rewards_campaign ON rewards(campaign_id);`,
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_reward_rates_campaign_area ON reward_rates(campaign_id, area_type);`,
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_spin_results_user_campaign ON spin_results(user_id, campaign_id);`,
    );

    // ================== ADMIN ACCOUNT ==================
    const adminUsername = "admin_tuandev";
    const adminPhone = "0999999999";

    const adminExists = await client.query(
      `SELECT * FROM users WHERE username = $1 OR phone = $2`,
      [adminUsername, adminPhone],
    );

    if (adminExists.rowCount === 0) {
      const defaultPassword = "Admin@123";
      const hashedPassword = await bcrypt.hash(defaultPassword, 10);

      await client.query(
        `INSERT INTO users (username, phone, password, role, status) VALUES ($1, $2, $3, $4, $5)`,
        [adminUsername, adminPhone, hashedPassword, "admin", "active"],
      );
      console.log(`✅ Đã tạo tài khoản Admin mặc định cho Production:`);
      console.log(`   - Username: ${adminUsername}`);
      console.log(`   - Phone: ${adminPhone}`);
      console.log(`   - Mật khẩu: Admin@123`);
    } else {
      console.log(
        `ℹ️ Tài khoản Admin (${adminUsername} hoặc SDT ${adminPhone}) đã tồn tại.`,
      );
    }

    // 4. COMMIT TRANSACTION
    await client.query("COMMIT");
    console.log("🚀 FINAL TRAVEL MINIGAME DB READY (Transaction Completed)");
  } catch (err) {
    // 5. ROLLBACK NẾU CÓ LỖI
    await client.query("ROLLBACK");
    console.error("❌ Lỗi trong quá trình khởi tạo Database:", err);
  } finally {
    // 6. GIẢI PHÓNG CLIENT VỀ POOL
    client.release();
  }
};

initTables();

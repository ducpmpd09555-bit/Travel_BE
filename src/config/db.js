import { Pool } from "pg";
import dotenv from "dotenv";
dotenv.config();
let pool;
if (!global.pgPool) {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    console.warn(
      "⚠️ Cảnh báo: Biến môi trường DATABASE_URL không tồn tại. Vui lòng kiểm tra lại cấu hình (.env hoặc Railway Variables).",
    );
  }

  global.pgPool = new Pool({
    connectionString: connectionString,
    ssl: {
      rejectUnauthorized: false,
    },
    max: 15,
    idleTimeoutMillis: 30000,
  });
}

pool = global.pgPool;

pool.on("connect", () => {
  console.log("✅ Kết nối PostgreSQL Pool thành công.");
});

pool.on("error", (err) => {
  console.error("❌ Lỗi Pool PostgreSQL:", err);
});

export default pool;

import pool from "../../config/db.js";

export const getCampaignByIdService = async (id) => {
  // Trả về các thông tin cần thiết cho User. Có thể chặn xem các chiến dịch có status = 'cancelled'
  const result = await pool.query(
    `SELECT 
       id, 
       name, 
       slogan, 
       description, 
       start_date, 
       end_date, 
       banner_url, 
       status
     FROM campaigns 
     WHERE id = $1 AND status != 'cancelled'`,
    [id],
  );

  if (result.rows.length === 0) {
    throw {
      status: 404,
      message: "Không tìm thấy chiến dịch hoặc chiến dịch đã bị hủy",
    };
  }

  return result.rows[0];
};

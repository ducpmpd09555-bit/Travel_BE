import pool from "../../config/db.js";

export const getRewardsForUserService = async (campaign_id) => {
  // Không SELECT các thông tin mật như voucher_value thật hay rates
  const result = await pool.query(
    `SELECT 
       id, name, type, description, image_url,
       CASE 
         WHEN remaining_quantity <= 0 THEN 'out_of_stock' 
         ELSE status 
       END as display_status
     FROM rewards 
     WHERE campaign_id = $1 AND status != 'cancelled'
     ORDER BY type DESC, created_at ASC`,
    [campaign_id],
  );

  return result.rows;
};

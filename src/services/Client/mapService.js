import pool from "../../config/db.js";

export const getActiveCountriesService = async (campaign_id) => {
  // Chỉ lấy quốc gia có status = 'active'
  const result = await pool.query(
    `SELECT id, name, slug, description, image_url 
     FROM countries 
     WHERE campaign_id = $1 AND status = 'active' 
     ORDER BY created_at ASC`,
    [campaign_id],
  );
  return result.rows;
};

export const getActiveLocationsService = async (country_id) => {
  // Chỉ lấy địa điểm có status = 'active'
  const result = await pool.query(
    `SELECT id, name, slug, description, image_url, map_url 
     FROM locations 
     WHERE country_id = $1 AND status = 'active' 
     ORDER BY created_at ASC`,
    [country_id],
  );
  return result.rows;
};

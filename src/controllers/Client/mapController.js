import * as mapService from "../../services/Client/mapService.js";

export const getActiveCountries = async (req, res) => {
  try {
    const { campaign_id } = req.query;
    if (!campaign_id) {
      return res
        .status(400)
        .json({ success: false, message: "Thiếu campaign_id" });
    }

    const data = await mapService.getActiveCountriesService(campaign_id);
    return res.status(200).json({
      success: true,
      message: "Lấy danh sách quốc gia thành công",
      data,
    });
  } catch (error) {
    return res
      .status(error.status || 500)
      .json({ success: false, message: error.message });
  }
};

export const getActiveLocations = async (req, res) => {
  try {
    const { country_id } = req.query;
    if (!country_id) {
      return res
        .status(400)
        .json({ success: false, message: "Thiếu country_id" });
    }

    const data = await mapService.getActiveLocationsService(country_id);
    return res.status(200).json({
      success: true,
      message: "Lấy danh sách địa điểm thành công",
      data,
    });
  } catch (error) {
    return res
      .status(error.status || 500)
      .json({ success: false, message: error.message });
  }
};

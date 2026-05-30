import * as countryService from "../../services/Admin/countryService.js";
import * as locationService from "../../services/Admin/locationService.js";

// ================= COUNTRIES =================
export const createCountry = async (req, res) => {
  try {
    const data = await countryService.createCountryService(req.body);
    return res
      .status(201)
      .json({ success: true, message: "Thêm quốc gia thành công", data });
  } catch (error) {
    return res
      .status(error.status || 500)
      .json({ success: false, message: error.message });
  }
};

export const getAllCountries = async (req, res) => {
  try {
    const data = await countryService.getAllCountriesService(req.query);
    return res
      .status(200)
      .json({
        success: true,
        message: "Lấy danh sách quốc gia thành công",
        ...data,
      });
  } catch (error) {
    return res
      .status(error.status || 500)
      .json({ success: false, message: error.message });
  }
};

export const getCountryById = async (req, res) => {
  try {
    const data = await countryService.getCountryByIdService(req.params.id);
    return res
      .status(200)
      .json({
        success: true,
        message: "Lấy chi tiết quốc gia thành công",
        data,
      });
  } catch (error) {
    return res
      .status(error.status || 500)
      .json({ success: false, message: error.message });
  }
};

export const updateCountry = async (req, res) => {
  try {
    const data = await countryService.updateCountryService(
      req.params.id,
      req.body,
    );
    return res
      .status(200)
      .json({ success: true, message: "Cập nhật quốc gia thành công", data });
  } catch (error) {
    return res
      .status(error.status || 500)
      .json({ success: false, message: error.message });
  }
};

// ================= LOCATIONS =================
export const createLocation = async (req, res) => {
  try {
    const data = await locationService.createLocationService(req.body);
    return res
      .status(201)
      .json({ success: true, message: "Thêm địa điểm thành công", data });
  } catch (error) {
    return res
      .status(error.status || 500)
      .json({ success: false, message: error.message });
  }
};

export const getAllLocations = async (req, res) => {
  try {
    const data = await locationService.getAllLocationsService(req.query);
    return res
      .status(200)
      .json({
        success: true,
        message: "Lấy danh sách địa điểm thành công",
        ...data,
      });
  } catch (error) {
    return res
      .status(error.status || 500)
      .json({ success: false, message: error.message });
  }
};

export const getLocationById = async (req, res) => {
  try {
    const data = await locationService.getLocationByIdService(req.params.id);
    return res
      .status(200)
      .json({
        success: true,
        message: "Lấy chi tiết địa điểm thành công",
        data,
      });
  } catch (error) {
    return res
      .status(error.status || 500)
      .json({ success: false, message: error.message });
  }
};

export const updateLocation = async (req, res) => {
  try {
    const data = await locationService.updateLocationService(
      req.params.id,
      req.body,
    );
    return res
      .status(200)
      .json({ success: true, message: "Cập nhật địa điểm thành công", data });
  } catch (error) {
    return res
      .status(error.status || 500)
      .json({ success: false, message: error.message });
  }
};

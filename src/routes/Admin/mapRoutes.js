import express from "express";
import {
  createCountry,
  getAllCountries,
  getCountryById,
  updateCountry,
  createLocation,
  getAllLocations,
  getLocationById,
  updateLocation,
} from "../../controllers/Admin/mapController.js";
import {
  authenticate,
  authorization,
} from "../../middleware/authMiddleware.js";

const router = express.Router();

router.use(authenticate, authorization(["admin"]));

// ================= COUNTRIES ROUTES =================
router.post("/countries", createCountry);
router.get("/countries", getAllCountries);
router.get("/countries/:id", getCountryById);
router.put("/countries/:id", updateCountry);

// ================= LOCATIONS ROUTES =================
router.post("/locations", createLocation);
router.get("/locations", getAllLocations);
router.get("/locations/:id", getLocationById);
router.put("/locations/:id", updateLocation);

export default router;

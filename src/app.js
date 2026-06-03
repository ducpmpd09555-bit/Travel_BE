import express from "express";
import cors from "cors";
import morgan from "morgan";
import dotenv from "dotenv";
import bodyParser from "body-parser";
import spinResultRoutes from "./routes/Admin/spinResultRoutes.js";
import dashboardRoutes from "./routes/Admin/dashboardRoutes.js";
import campaignAdminRoutes from "./routes/Admin/campaignRoutes.js";
import mapAdminRoutes from "./routes/Admin/mapRoutes.js";
import questionAdminRoutes from "./routes/Admin/questionRoutes.js";
import rewardAdminRoutes from "./routes/Admin/rewardRoutes.js";
import campaignUserRoutes from "./routes/campaignRoutes.js";
import sharePostRoutes from "./routes/Admin/sharePostRoutes.js";
import userAdminRoutes from "./routes/Admin/userRoutes.js";
import mapRoutes from "./routes/Client/mapRoutes.js";
import questionUserRoutes from "./routes/Client/questionRoutes.js";
import rewardUserRoutes from "./routes/Client/rewardRoutes.js";
import playRoutes from "./routes/Client/playRoutes.js";
import authRoutes from "./routes/authRoutes.js";

dotenv.config();

const app = express();

app.use(cors());
app.use(morgan("dev"));
app.use(express.json({ limit: "10mb" }));
app.use(bodyParser.json({ limit: "10mb" }));
app.use(bodyParser.urlencoded({ extended: true }));

app.use("/api/admin/users", userAdminRoutes);
app.use("/api/admin/campaigns", campaignAdminRoutes);
app.use("/api/admin/questions", questionAdminRoutes);
app.use("/api/admin/rewards", rewardAdminRoutes);
app.use("/api/admin/map", mapAdminRoutes);
app.use("/api/admin/share-posts", sharePostRoutes);
app.use("/api/admin/dashboard", dashboardRoutes);
app.use("/api/admin/spin-results", spinResultRoutes);
app.use("/api/campaigns", campaignUserRoutes);
app.use("/api/questions", questionUserRoutes);
app.use("/api/rewards", rewardUserRoutes);
app.use("/api/map", mapRoutes);
app.use("/api/play", playRoutes);
app.use("/api/auth", authRoutes);
app.get("/", (req, res) => {
  res.send("TRAVEL MINIGAME API READY 🚀");
});

export default app;

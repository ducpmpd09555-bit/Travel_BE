import express from "express";
import cors from "cors";
import morgan from "morgan";
import dotenv from "dotenv";
import bodyParser from "body-parser";
dotenv.config();

const app = express();

app.use(cors());
app.use(morgan("dev"));
app.use(express.json({ limit: "5mb" }));
app.use(bodyParser.json({ limit: "10mb" }));
app.use(bodyParser.urlencoded({ extended: true }));

app.get("/", (req, res) => {
  res.send("Travel");
});

export default app;

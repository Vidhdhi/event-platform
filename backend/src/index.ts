import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { pool } from "./db";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");
    res.json({ status: "ok", dbTime: result.rows[0].now });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: "error", message: "DB connection failed" });
  }
});
app.get("/services", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT s.service_id, s.title, s.category, s.city, s.price,
              r.average_rating, r.review_count
       FROM services s
       JOIN service_ratings r ON r.service_id = s.service_id
       ORDER BY s.created_at DESC
       LIMIT 20`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to load services" });
  }
});
const port = process.env.PORT || 5001;
app.listen(port, () => console.log(`Backend running on port ${port}`));
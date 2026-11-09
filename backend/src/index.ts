import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { pool } from "./db";
import authRoutes from "./routes/auth";
import eventRoutes from "./routes/events";
import serviceRoutes from "./routes/services";
import bookingRoutes from "./routes/bookings";
import reviewRoutes from "./routes/reviews";
import notificationRoutes from "./routes/notifications";
dotenv.config();
if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET is missing in .env");
}
const app = express();
app.use(cors());
app.use(express.json());
app.use("/auth", authRoutes);
app.use("/events", eventRoutes);
app.use("/services", serviceRoutes);
app.use("/bookings", bookingRoutes);
app.use("/reviews", reviewRoutes);
app.use("/notifications", notificationRoutes);
app.get("/health", async (req, res) => {
  
  try {
    const result = await pool.query("SELECT NOW()");
    res.json({ status: "ok", dbTime: result.rows[0].now });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: "error", message: "DB connection failed" });
  }
});

const port = process.env.PORT || 5001;
app.listen(port, () => console.log(`Backend running on port ${port}`));
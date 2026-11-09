import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
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

export const app = express();

// Needed behind Render's proxy so the rate limiter sees the visitor's real IP
app.set("trust proxy", 1);

app.use(helmet());

// In production only the frontend's address may call the API
const allowedOrigins = (process.env.CORS_ORIGIN ?? "")
  .split(",")
  .map((o) => o.trim().replace(/\/$/, ""))
  .filter(Boolean);
app.use(cors({ origin: allowedOrigins.length > 0 ? allowedOrigins : true }));
app.use(express.json({ limit: "100kb" }));

// Slows down password guessing (switched off while running tests)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many attempts. Please try again in a few minutes." },
  skip: () => process.env.NODE_ENV === "test",
});
app.use("/auth/login", authLimiter);
app.use("/auth/register", authLimiter);

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

// Unknown routes get JSON, not an HTML page
app.use((req: Request, res: Response) => {
  res.status(404).json({ message: "Route not found" });
});

// Catches bad JSON and any unexpected error
app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
  if (err?.type === "entity.parse.failed") {
    res.status(400).json({ message: "Request body is not valid JSON" });
    return;
  }
  if (err?.type === "entity.too.large") {
    res.status(413).json({ message: "Request body is too large" });
    return;
  }
  console.error(err);
  res.status(500).json({ message: "Something went wrong" });
});
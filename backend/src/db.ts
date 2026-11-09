import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 15_000, // allows for a Neon cold start
});

// A sleeping database can drop idle connections. Log it instead of crashing the server.
pool.on("error", (err) => {
  console.error("Unexpected database error:", err.message);
});
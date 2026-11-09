import { pool } from "./db";

// Creates a notification. A failure here must never break the main action,
// so errors are logged and swallowed.
export async function notify(
  userId: string,
  type: string,
  message: string,
  link?: string
) {
  try {
    await pool.query(
      `INSERT INTO notifications (user_id, type, message, link)
       VALUES ($1, $2, $3, $4)`,
      [userId, type, message, link ?? null]
    );
  } catch (err) {
    console.error("Failed to create notification:", err);
  }
}
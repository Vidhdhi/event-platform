import { Router } from "express";
import { z } from "zod";
import { pool } from "../db";
import { requireAuth } from "../middleware/auth";

const router = Router();

router.use(requireAuth);

const uuidSchema = z.string().uuid();

// GET /notifications  (latest 30 plus the unread count)
router.get("/", async (req, res) => {
  try {
    const list = await pool.query(
      `SELECT notification_id, type, message, link, is_read, created_at
       FROM notifications
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 30`,
      [req.user!.userId]
    );
    const unread = await pool.query(
      `SELECT COUNT(*)::int AS count
       FROM notifications WHERE user_id = $1 AND is_read = FALSE`,
      [req.user!.userId]
    );
    res.json({ unreadCount: unread.rows[0].count, items: list.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to load notifications" });
  }
});

// POST /notifications/read-all
router.post("/read-all", async (req, res) => {
  try {
    await pool.query(
      `UPDATE notifications SET is_read = TRUE
       WHERE user_id = $1 AND is_read = FALSE`,
      [req.user!.userId]
    );
    res.json({ message: "All notifications marked as read" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to update notifications" });
  }
});

// PATCH /notifications/:id/read
router.patch("/:id/read", async (req, res) => {
  const id = String(req.params.id);
  if (!uuidSchema.safeParse(id).success) {
    res.status(400).json({ message: "Invalid notification id" });
    return;
  }
  try {
    const result = await pool.query(
      `UPDATE notifications SET is_read = TRUE
       WHERE notification_id = $1 AND user_id = $2`,
      [id, req.user!.userId]
    );
    if (result.rowCount === 0) {
      res.status(404).json({ message: "Notification not found" });
      return;
    }
    res.json({ message: "Marked as read" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to update notification" });
  }
});

export default router;
import { Router } from "express";
import { z } from "zod";
import { pool } from "../db";
import { requireAuth, requireRole } from "../middleware/auth";
import { notify } from "../notify";

const router = Router();

const reviewSchema = z.object({
  serviceId: z.string().uuid("Invalid service id"),
  rating: z.number().int().min(1, "Choose 1 to 5 stars").max(5, "Choose 1 to 5 stars"),
  comment: z.string().max(1000).optional(),
});

const uuidSchema = z.string().uuid();

// POST /reviews  (planner, only after a completed booking; posting again edits the review)
router.post("/", requireAuth, requireRole("user"), async (req, res) => {
  const parsed = reviewSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      message: parsed.error.issues.map((i) => i.message).join(", "),
    });
    return;
  }
  const { serviceId, rating, comment } = parsed.data;
  const userId = req.user!.userId;

  try {
    // Only planners with a completed booking for this service may review it
    const eligible = await pool.query(
      `SELECT 1
       FROM bookings b
       JOIN events e ON e.event_id = b.event_id
       WHERE e.user_id = $1 AND b.service_id = $2 AND b.status = 'completed'
       LIMIT 1`,
      [userId, serviceId]
    );
    if (eligible.rows.length === 0) {
      res.status(403).json({
        message: "You can review a vendor only after a completed booking",
      });
      return;
    }

    const existing = await pool.query(
      `SELECT 1 FROM reviews WHERE user_id = $1 AND service_id = $2`,
      [userId, serviceId]
    );
    const isEdit = existing.rows.length > 0;

    const result = await pool.query(
      `INSERT INTO reviews (user_id, service_id, rating, comment)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, service_id)
       DO UPDATE SET rating = EXCLUDED.rating,
                     comment = EXCLUDED.comment,
                     created_at = NOW()
       RETURNING review_id, service_id, rating, comment, created_at`,
      [userId, serviceId, rating, comment?.trim() || null]
    );

    // Tell the vendor
    const info = await pool.query(
      `SELECT s.title, v.user_id AS vendor_user_id
       FROM services s JOIN vendors v ON v.vendor_id = s.vendor_id
       WHERE s.service_id = $1`,
      [serviceId]
    );
    if (info.rows[0]) {
      await notify(
        info.rows[0].vendor_user_id,
        "review",
        `${isEdit ? "A review was updated" : "New review"}: ${rating} ${
          rating === 1 ? "star" : "stars"
        } on "${info.rows[0].title}"`,
        "/vendor"
      );
    }

    res.status(isEdit ? 200 : 201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to save the review" });
  }
});

// GET /reviews/mine  (the planner's own reviews)
router.get("/mine", requireAuth, requireRole("user"), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT service_id, rating, comment, created_at
       FROM reviews WHERE user_id = $1`,
      [req.user!.userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to load your reviews" });
  }
});

// GET /reviews/service/:serviceId  (public)
router.get("/service/:serviceId", async (req, res) => {
  const serviceId = String(req.params.serviceId);
  if (!uuidSchema.safeParse(serviceId).success) {
    res.status(400).json({ message: "Invalid service id" });
    return;
  }
  try {
    const result = await pool.query(
      `SELECT r.review_id, r.rating, r.comment, r.created_at,
              u.name AS reviewer_name
       FROM reviews r
       JOIN users u ON u.user_id = r.user_id
       WHERE r.service_id = $1
       ORDER BY r.created_at DESC
       LIMIT 50`,
      [serviceId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to load reviews" });
  }
});

export default router;

import { Router } from "express";
import { z } from "zod";
import { pool } from "../db";
import { requireAuth } from "../middleware/auth";
import { notify } from "../notify";
const router = Router();

// Every booking route needs a logged-in user
router.use(requireAuth);

const createSchema = z.object({
  eventId: z.string().uuid("Invalid event id"),
  serviceId: z.string().uuid("Invalid service id"),
  message: z.string().max(1000).optional(),
});

const statusSchema = z.object({
  status: z.enum(["accepted", "rejected", "completed", "cancelled"]),
  agreedPrice: z.number().min(0).optional(),
});

const uuidSchema = z.string().uuid();

// Who may move a booking from one status to another
const VENDOR_TRANSITIONS: Record<string, string[]> = {
  pending: ["accepted", "rejected"],
  accepted: ["completed"],
};
const PLANNER_TRANSITIONS: Record<string, string[]> = {
  pending: ["cancelled"],
  accepted: ["cancelled"],
};

function validationMessage(error: z.ZodError) {
  return error.issues.map((i) => i.message).join(", ");
}

// POST /bookings  (planner sends a request)
router.post("/", async (req, res) => {
  if (req.user!.role !== "user") {
    res.status(403).json({ message: "Only planners can create bookings" });
    return;
  }

  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: validationMessage(parsed.error) });
    return;
  }
  const { eventId, serviceId, message } = parsed.data;

  try {
    // The event must belong to this planner
    const event = await pool.query(
            `SELECT event_id, title FROM events WHERE event_id = $1 AND user_id = $2`,
      [eventId, req.user!.userId]
    );
    if (event.rows.length === 0) {
      res.status(404).json({ message: "Event not found" });
      return;
    }

    const service = await pool.query(
            `SELECT s.service_id, s.title, v.user_id AS vendor_user_id
       FROM services s JOIN vendors v ON v.vendor_id = s.vendor_id
       WHERE s.service_id = $1`,
      [serviceId]
    );
    if (service.rows.length === 0) {
      res.status(404).json({ message: "Service not found" });
      return;
    }

    const result = await pool.query(
      `INSERT INTO bookings (event_id, service_id, message)
       VALUES ($1, $2, $3)
       RETURNING booking_id, event_id, service_id, status, message, booking_date`,
      [eventId, serviceId, message ?? null]
    );
        await notify(
      service.rows[0].vendor_user_id,
      "booking_request",
      `New booking request for "${service.rows[0].title}" (${event.rows[0].title})`,
      "/vendor"
    );
    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    // 23505 = UNIQUE (event_id, service_id) already exists
    if (err.code === "23505") {
      res
        .status(409)
        .json({ message: "You already requested this service for this event" });
      return;
    }
    console.error(err);
    res.status(500).json({ message: "Failed to create booking" });
  }
});

// GET /bookings  (planner: their bookings, vendor: requests for their services)
// Optional filters: ?eventId=...&status=pending
router.get("/", async (req, res) => {
  const { userId, role } = req.user!;
  const eventId = req.query.eventId ? String(req.query.eventId) : undefined;
  const status = req.query.status ? String(req.query.status) : undefined;

  if (eventId && !uuidSchema.safeParse(eventId).success) {
    res.status(400).json({ message: "Invalid event id" });
    return;
  }

  try {
    const params: unknown[] = [];
    const where: string[] = [];

    if (role === "user") {
      params.push(userId);
      where.push(`e.user_id = $${params.length}`);
    } else if (role === "vendor") {
      params.push(userId);
      where.push(`v.user_id = $${params.length}`);
    } else {
      res.status(403).json({ message: "You do not have permission" });
      return;
    }

    if (eventId) {
      params.push(eventId);
      where.push(`b.event_id = $${params.length}`);
    }
    if (status) {
      params.push(status);
      where.push(`b.status::text = $${params.length}`);
    }

    const result = await pool.query(
      `SELECT b.booking_id, b.status, b.message, b.booking_date,
              b.agreed_price::float8 AS agreed_price,
              e.event_id, e.title AS event_title, e.event_type, e.event_date,
              e.city AS event_city, e.guest_count,
              u.name AS planner_name,
              s.service_id, s.title AS service_title, s.category,
              s.price::float8 AS price,
              v.business_name
       FROM bookings b
       JOIN events e   ON e.event_id = b.event_id
       JOIN users u    ON u.user_id = e.user_id
       JOIN services s ON s.service_id = b.service_id
       JOIN vendors v  ON v.vendor_id = s.vendor_id
       WHERE ${where.join(" AND ")}
       ORDER BY b.booking_date DESC`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to load bookings" });
  }
});

// PATCH /bookings/:id/status
router.patch("/:id/status", async (req, res) => {
  const id = String(req.params.id);
  if (!uuidSchema.safeParse(id).success) {
    res.status(400).json({ message: "Invalid booking id" });
    return;
  }

  const parsed = statusSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: validationMessage(parsed.error) });
    return;
  }
  const { status: newStatus, agreedPrice } = parsed.data;
  const { userId, role } = req.user!;

  try {
    const found = await pool.query(
      `SELECT b.booking_id, b.status::text AS status, b.event_id, b.service_id,
              e.user_id AS planner_id, e.event_date, e.total_budget::float8 AS total_budget,
                            s.price::float8 AS price, v.user_id AS vendor_user_id,
              e.title AS event_title, s.title AS service_title
       FROM bookings b
       JOIN events e   ON e.event_id = b.event_id
       JOIN services s ON s.service_id = b.service_id
       JOIN vendors v  ON v.vendor_id = s.vendor_id
       WHERE b.booking_id = $1`,
      [id]
    );
    const booking = found.rows[0];

    // Return 404 (not 403) when it is not theirs, so ids cannot be guessed
    const isPlanner = role === "user" && booking?.planner_id === userId;
    const isVendor = role === "vendor" && booking?.vendor_user_id === userId;
    if (!booking || (!isPlanner && !isVendor)) {
      res.status(404).json({ message: "Booking not found" });
      return;
    }

    const allowed = (isVendor ? VENDOR_TRANSITIONS : PLANNER_TRANSITIONS)[
      booking.status
    ];
    if (!allowed || !allowed.includes(newStatus)) {
      res.status(400).json({
        message: `You cannot change a ${booking.status} booking to ${newStatus}`,
      });
      return;
    }

    let finalPrice: number | null = null;

    if (newStatus === "accepted") {
      // Same service already accepted for another event on the same date?
      const clash = await pool.query(
        `SELECT 1
         FROM bookings b2
         JOIN events e2 ON e2.event_id = b2.event_id
         WHERE b2.service_id = $1
           AND b2.status = 'accepted'
           AND b2.booking_id <> $2
           AND e2.event_date::date = $3::date
         LIMIT 1`,
        [booking.service_id, booking.booking_id, booking.event_date]
      );
      if (clash.rows.length > 0) {
        res.status(409).json({
          message: "You already accepted another booking for this service on that date",
        });
        return;
      }
      finalPrice = agreedPrice ?? booking.price;
    }

    await pool.query(
      `UPDATE bookings
       SET status = $1, agreed_price = COALESCE($2::numeric, agreed_price)
       WHERE booking_id = $3`,
      [newStatus, finalPrice, booking.booking_id]
    );
    if (isVendor) {
      const texts: Record<string, string> = {
        accepted: `Your request for "${booking.service_title}" was accepted`,
        rejected: `Your request for "${booking.service_title}" was declined`,
        completed: `"${booking.service_title}" is marked as completed. You can now leave a review`,
      };
      await notify(
        booking.planner_id,
        `booking_${newStatus}`,
        texts[newStatus],
        `/events/${booking.event_id}`
      );
    } else {
      await notify(
        booking.vendor_user_id,
        "booking_cancelled",
        `A request for "${booking.service_title}" was cancelled (${booking.event_title})`,
        "/vendor"
      );
    }
    const updated = await pool.query(
      `SELECT booking_id, event_id, service_id, status,
              agreed_price::float8 AS agreed_price, message, booking_date
       FROM bookings WHERE booking_id = $1`,
      [booking.booking_id]
    );
    const response: Record<string, unknown> = { ...updated.rows[0] };

    // After accepting, tell the vendor/planner if the event is now over budget
    if (newStatus === "accepted") {
      const spent = await pool.query(
        `SELECT
           COALESCE((SELECT SUM(COALESCE(b.agreed_price, s.price))
                     FROM bookings b JOIN services s ON s.service_id = b.service_id
                     WHERE b.event_id = $1 AND b.status IN ('accepted','completed')), 0)
         + COALESCE((SELECT SUM(amount) FROM budget_items WHERE event_id = $1), 0)
         AS allocated`,
        [booking.event_id]
      );
      const allocated = Number(spent.rows[0].allocated);
      response.eventAllocated = allocated;
      response.eventOverBudget = allocated > booking.total_budget;
    }

    res.json(response);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to update booking" });
  }
});

export default router;
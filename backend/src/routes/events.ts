import { Router, Request, Response } from "express";
import { z } from "zod";
import { pool } from "../db";
import { requireAuth, requireRole } from "../middleware/auth";

const router = Router();

// Every route in this file needs a logged-in planner
router.use(requireAuth, requireRole("user"));

const eventSchema = z.object({
  title: z.string().min(2, "Title must be at least 2 characters"),
  eventType: z.enum(["wedding", "birthday", "corporate", "other"]),
  eventDate: z.coerce.date(),
  city: z.string().min(2, "City is required"),
  guestCount: z.number().int().min(0).default(0),
  totalBudget: z.number().min(0, "Budget cannot be negative"),
});

const budgetItemSchema = z.object({
  category: z.string().min(2),
  amount: z.number().min(0),
  note: z.string().optional(),
});

const uuidSchema = z.string().uuid();

function validationMessage(error: z.ZodError) {
  return error.issues.map((i) => i.message).join(", ");
}

// Returns the event only if it belongs to the logged-in user
async function getOwnedEvent(req: Request, res: Response) {
  const id = String(req.params.id);
  if (!uuidSchema.safeParse(id).success) {
    res.status(400).json({ message: "Invalid event id" });
    return null;
  }
  const result = await pool.query(
    `SELECT * FROM events WHERE event_id = $1 AND user_id = $2`,
    [id, req.user!.userId]
  );
  if (result.rows.length === 0) {
    res.status(404).json({ message: "Event not found" });
    return null;
  }
  return result.rows[0];
}

// POST /events  (create)
router.post("/", async (req, res) => {
  const parsed = eventSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: validationMessage(parsed.error) });
    return;
  }
  const e = parsed.data;

  try {
    const result = await pool.query(
      `INSERT INTO events (user_id, title, event_type, event_date, city, guest_count, total_budget)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [req.user!.userId, e.title, e.eventType, e.eventDate, e.city, e.guestCount, e.totalBudget]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to create event" });
  }
});

// GET /events  (list my events)
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM events WHERE user_id = $1 ORDER BY event_date ASC`,
      [req.user!.userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to load events" });
  }
});

// GET /events/:id  (one event)
router.get("/:id", async (req, res) => {
  try {
    const event = await getOwnedEvent(req, res);
    if (!event) return;
    res.json(event);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to load event" });
  }
});

// PUT /events/:id  (update)
router.put("/:id", async (req, res) => {
  const parsed = eventSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: validationMessage(parsed.error) });
    return;
  }
  const e = parsed.data;

  try {
    const event = await getOwnedEvent(req, res);
    if (!event) return;

    const result = await pool.query(
      `UPDATE events
       SET title = $1, event_type = $2, event_date = $3, city = $4,
           guest_count = $5, total_budget = $6
       WHERE event_id = $7
       RETURNING *`,
      [e.title, e.eventType, e.eventDate, e.city, e.guestCount, e.totalBudget, event.event_id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to update event" });
  }
});

// DELETE /events/:id
router.delete("/:id", async (req, res) => {
  try {
    const event = await getOwnedEvent(req, res);
    if (!event) return;

    await pool.query(`DELETE FROM events WHERE event_id = $1`, [event.event_id]);
    res.json({ message: "Event deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to delete event" });
  }
});

// GET /events/:id/budget  (estimated vs actual)
router.get("/:id/budget", async (req, res) => {
  try {
    const event = await getOwnedEvent(req, res);
    if (!event) return;

    // Confirmed vendor spending (accepted or completed bookings)
    const confirmed = await pool.query(
      `SELECT b.booking_id, s.category, s.title,
              COALESCE(b.agreed_price, s.price) AS amount, b.status
       FROM bookings b
       JOIN services s ON s.service_id = b.service_id
       WHERE b.event_id = $1 AND b.status IN ('accepted', 'completed')`,
      [event.event_id]
    );

    // Pending requests (not spent yet, but worth showing)
    const pending = await pool.query(
      `SELECT b.booking_id, s.category, s.title, s.price AS amount, b.status
       FROM bookings b
       JOIN services s ON s.service_id = b.service_id
       WHERE b.event_id = $1 AND b.status = 'pending'`,
      [event.event_id]
    );

    // Manual expenses
    const items = await pool.query(
      `SELECT item_id, category, amount, note
       FROM budget_items WHERE event_id = $1 ORDER BY created_at`,
      [event.event_id]
    );

    const sum = (rows: { amount: string }[]) =>
      rows.reduce((total, r) => total + Number(r.amount), 0);

    const totalBudget = Number(event.total_budget);
    const confirmedSpent = sum(confirmed.rows);
    const manualSpent = sum(items.rows);
    const pendingTotal = sum(pending.rows);
    const allocated = confirmedSpent + manualSpent;

    res.json({
      eventId: event.event_id,
      totalBudget,
      allocated,
      remainingBalance: totalBudget - allocated,
      pendingTotal,
      remainingIfPendingAccepted: totalBudget - allocated - pendingTotal,
      overBudget: allocated > totalBudget,
      confirmedBookings: confirmed.rows,
      pendingBookings: pending.rows,
      manualItems: items.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to load budget" });
  }
});

// POST /events/:id/budget-items  (add a manual expense)
router.post("/:id/budget-items", async (req, res) => {
  const parsed = budgetItemSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: validationMessage(parsed.error) });
    return;
  }

  try {
    const event = await getOwnedEvent(req, res);
    if (!event) return;

    const { category, amount, note } = parsed.data;
    const result = await pool.query(
      `INSERT INTO budget_items (event_id, category, amount, note)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [event.event_id, category, amount, note ?? null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to add budget item" });
  }
});

// DELETE /events/:id/budget-items/:itemId
router.delete("/:id/budget-items/:itemId", async (req, res) => {
  try {
    const event = await getOwnedEvent(req, res);
    if (!event) return;

    const itemId = String(req.params.itemId);
    if (!uuidSchema.safeParse(itemId).success) {
      res.status(400).json({ message: "Invalid item id" });
      return;
    }

    const result = await pool.query(
      `DELETE FROM budget_items WHERE item_id = $1 AND event_id = $2`,
      [itemId, event.event_id]
    );
    if (result.rowCount === 0) {
      res.status(404).json({ message: "Budget item not found" });
      return;
    }
    res.json({ message: "Budget item deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to delete budget item" });
  }
});

export default router;
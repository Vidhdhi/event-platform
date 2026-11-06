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
// ---------- AI recommendations ----------

const recommendQuerySchema = z.object({
  category: z.string().optional(),
  preferences: z.string().max(500).optional(),
  limit: z.coerce.number().int().min(1).max(30).default(10),
});

interface AiResponse {
  count: number;
  recommendations: Array<{
    service_id: string;
    match_score: number;
    breakdown: Record<string, number>;
    within_budget: boolean;
    distance_km: number | null;
    reasons: string[];
  }>;
  elapsed_ms: number;
}

// Calls the Python AI microservice
async function callAiService(payload: unknown): Promise<AiResponse> {
  const baseUrl = process.env.AI_SERVICE_URL || "http://localhost:8000";
  const response = await fetch(`${baseUrl}/recommend`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) {
    throw new Error(`AI service returned ${response.status}`);
  }
  return (await response.json()) as AiResponse;
}

// GET /events/:id/recommendations?category=Photography&preferences=candid%20photos&limit=10
router.get("/:id/recommendations", async (req, res) => {
  const parsed = recommendQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ message: validationMessage(parsed.error) });
    return;
  }
  const q = parsed.data;
  const startedAt = Date.now();

  try {
    const event = await getOwnedEvent(req, res);
    if (!event) return;

    // 1. Load candidate services from the database
    const params: unknown[] = [];
    let categoryFilter = "";
    if (q.category) {
      params.push(q.category);
      categoryFilter = "WHERE s.category = $1";
    }

    const candidates = await pool.query(
      `SELECT s.service_id, s.title, s.description, s.category,
              s.price::float8 AS price, s.currency, s.is_negotiable, s.city,
              s.image_urls, v.business_name,
              r.average_rating::float8 AS average_rating,
              r.review_count::int AS review_count
       FROM services s
       JOIN vendors v ON v.vendor_id = s.vendor_id
       JOIN service_ratings r ON r.service_id = s.service_id
       ${categoryFilter}
       LIMIT 500`,
      params
    );

    if (candidates.rows.length === 0) {
      res.json({ count: 0, recommendations: [], totalMs: Date.now() - startedAt });
      return;
    }

    // 2. Ask the AI service to rank them
    const payload = {
      event: {
        event_type: event.event_type,
        city: event.city,
        total_budget: Number(event.total_budget),
        guest_count: event.guest_count,
        category: q.category ?? null,
        preferences: q.preferences ?? null,
      },
      services: candidates.rows.map((s) => ({
        service_id: s.service_id,
        title: s.title,
        description: s.description,
        category: s.category,
        price: s.price,
        city: s.city,
        is_negotiable: s.is_negotiable,
        average_rating: s.average_rating,
        review_count: s.review_count,
      })),
      top_n: q.limit,
    };

    let ai: AiResponse;
    try {
      ai = await callAiService(payload);
    } catch (err) {
      console.error("AI service error:", err);
      res.status(503).json({ message: "Recommendation service is unavailable" });
      return;
    }

    // 3. Attach the service details to each ranked result
    const byId = new Map(candidates.rows.map((s) => [s.service_id, s]));
    const recommendations = ai.recommendations.map((r) => ({
      ...byId.get(r.service_id),
      match_score: r.match_score,
      breakdown: r.breakdown,
      within_budget: r.within_budget,
      distance_km: r.distance_km,
      reasons: r.reasons,
    }));

    res.json({
      count: recommendations.length,
      recommendations,
      aiMs: ai.elapsed_ms,
      totalMs: Date.now() - startedAt,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to generate recommendations" });
  }
});
export default router;
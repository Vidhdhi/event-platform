import { Router, Request, Response } from "express";
import { z } from "zod";
import { pool } from "../db";
import { requireAuth, requireRole } from "../middleware/auth";

const router = Router();

export const CATEGORIES = [
  "Photography",
  "Catering",
  "Venue",
  "Decoration",
  "Music & DJ",
  "Makeup",
  "Other",
] as const;

const serviceSchema = z.object({
  category: z.enum(CATEGORIES),
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().max(2000).optional(),
  price: z.number().min(0, "Price cannot be negative"),
  currency: z.string().default("LKR"),
  isNegotiable: z.boolean().default(false),
  city: z.string().min(2).optional(), // defaults to the vendor's city
  imageUrls: z.array(z.string().url()).max(10).default([]),
});
const updateSchema = z.object({
  category: z.enum(CATEGORIES).optional(),
  title: z.string().min(3, "Title must be at least 3 characters").optional(),
  description: z.string().max(2000).optional(),
  price: z.number().min(0, "Price cannot be negative").optional(),
  currency: z.string().optional(),
  isNegotiable: z.boolean().optional(),
  city: z.string().min(2).optional(),
  imageUrls: z.array(z.string().url()).max(10).optional(),
});
const searchSchema = z.object({
  category: z.string().optional(),
  city: z.string().optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
  q: z.string().optional(),
  sort: z.enum(["newest", "price_asc", "price_desc", "rating"]).default("newest"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
});

const uuidSchema = z.string().uuid();

function validationMessage(error: z.ZodError) {
  return error.issues.map((i) => i.message).join(", ");
}

// Shared SELECT used by search, detail and "my services"
const SERVICE_SELECT = `
  SELECT s.service_id, s.vendor_id, s.category, s.title, s.description,
         s.price::float8 AS price, s.currency, s.is_negotiable, s.city,
         s.image_urls, s.created_at,
         v.business_name,
         r.average_rating::float8 AS average_rating, r.review_count::int AS review_count
  FROM services s
  JOIN vendors v ON v.vendor_id = s.vendor_id
  JOIN service_ratings r ON r.service_id = s.service_id
`;

async function getVendorId(userId: string): Promise<string | null> {
  const result = await pool.query(
    `SELECT vendor_id FROM vendors WHERE user_id = $1`,
    [userId]
  );
  return result.rows[0]?.vendor_id ?? null;
}

// ---------- PUBLIC ROUTES ----------

// GET /services/categories
router.get("/categories", (req, res) => {
  res.json(CATEGORIES);
});

// GET /services?category=&city=&minPrice=&maxPrice=&minRating=&q=&sort=&page=&limit=
router.get("/", async (req, res) => {
  const parsed = searchSchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ message: validationMessage(parsed.error) });
    return;
  }
  const f = parsed.data;

  const where: string[] = [];
  const params: unknown[] = [];

  if (f.category) {
    params.push(f.category);
    where.push(`s.category = $${params.length}`);
  }
  if (f.city) {
    params.push(f.city);
    where.push(`LOWER(s.city) = LOWER($${params.length})`);
  }
  if (f.minPrice !== undefined) {
    params.push(f.minPrice);
    where.push(`s.price >= $${params.length}`);
  }
  if (f.maxPrice !== undefined) {
    params.push(f.maxPrice);
    where.push(`s.price <= $${params.length}`);
  }
  if (f.minRating !== undefined) {
    params.push(f.minRating);
    where.push(`r.average_rating >= $${params.length}`);
  }
  if (f.q) {
    params.push(`%${f.q}%`);
    const i = params.length;
    where.push(
      `(s.title ILIKE $${i} OR s.description ILIKE $${i} OR v.business_name ILIKE $${i})`
    );
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const orderBy = {
    newest: "s.created_at DESC",
    price_asc: "s.price ASC",
    price_desc: "s.price DESC",
    rating: "r.average_rating DESC, r.review_count DESC",
  }[f.sort];

  try {
    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS total
       FROM services s
       JOIN vendors v ON v.vendor_id = s.vendor_id
       JOIN service_ratings r ON r.service_id = s.service_id
       ${whereSql}`,
      params
    );
    const total = countResult.rows[0].total;

    const offset = (f.page - 1) * f.limit;
    const dataResult = await pool.query(
      `${SERVICE_SELECT}
       ${whereSql}
       ORDER BY ${orderBy}
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, f.limit, offset]
    );

    res.json({
      data: dataResult.rows,
      page: f.page,
      limit: f.limit,
      total,
      totalPages: Math.ceil(total / f.limit),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Search failed" });
  }
});

// ---------- VENDOR ROUTES ----------
// (must come before "/:id" so "mine" is not read as an id)

// GET /services/mine
router.get("/mine", requireAuth, requireRole("vendor"), async (req, res) => {
  try {
    const vendorId = await getVendorId(req.user!.userId);
    if (!vendorId) {
      res.status(404).json({ message: "Vendor profile not found" });
      return;
    }
    const result = await pool.query(
      `${SERVICE_SELECT} WHERE s.vendor_id = $1 ORDER BY s.created_at DESC`,
      [vendorId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to load your services" });
  }
});

// POST /services
router.post("/", requireAuth, requireRole("vendor"), async (req, res) => {
  const parsed = serviceSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: validationMessage(parsed.error) });
    return;
  }
  const s = parsed.data;

  try {
    const vendor = await pool.query(
      `SELECT vendor_id, city FROM vendors WHERE user_id = $1`,
      [req.user!.userId]
    );
    if (vendor.rows.length === 0) {
      res.status(404).json({ message: "Vendor profile not found" });
      return;
    }

    const result = await pool.query(
      `INSERT INTO services
         (vendor_id, category, title, description, price, currency, is_negotiable, city, image_urls)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING service_id`,
      [
        vendor.rows[0].vendor_id,
        s.category,
        s.title,
        s.description ?? null,
        s.price,
        s.currency,
        s.isNegotiable,
        s.city ?? vendor.rows[0].city,
        s.imageUrls,
      ]
    );

    const created = await pool.query(
      `${SERVICE_SELECT} WHERE s.service_id = $1`,
      [result.rows[0].service_id]
    );
    res.status(201).json(created.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to create service" });
  }
});

// Returns the service only if it belongs to the logged-in vendor
async function getOwnedServiceId(req: Request, res: Response) {
  const id = String(req.params.id);
  if (!uuidSchema.safeParse(id).success) {
    res.status(400).json({ message: "Invalid service id" });
    return null;
  }
  const vendorId = await getVendorId(req.user!.userId);
  if (!vendorId) {
    res.status(404).json({ message: "Vendor profile not found" });
    return null;
  }
  const result = await pool.query(
    `SELECT service_id, city FROM services WHERE service_id = $1 AND vendor_id = $2`,
    [id, vendorId]
  );
  if (result.rows.length === 0) {
    res.status(404).json({ message: "Service not found" });
    return null;
  }
  return result.rows[0];
}

// PUT /services/:id
// PUT /services/:id  (send only the fields you want to change)
router.put("/:id", requireAuth, requireRole("vendor"), async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: validationMessage(parsed.error) });
    return;
  }
  const s = parsed.data;

  try {
    const owned = await getOwnedServiceId(req, res);
    if (!owned) return;

    await pool.query(
      `UPDATE services
       SET category      = COALESCE($1, category),
           title         = COALESCE($2, title),
           description   = COALESCE($3, description),
           price         = COALESCE($4, price),
           currency      = COALESCE($5, currency),
           is_negotiable = COALESCE($6, is_negotiable),
           city          = COALESCE($7, city),
           image_urls    = COALESCE($8::text[], image_urls)
       WHERE service_id = $9`,
      [
        s.category ?? null,
        s.title ?? null,
        s.description ?? null,
        s.price ?? null,
        s.currency ?? null,
        s.isNegotiable ?? null,
        s.city ?? null,
        s.imageUrls ?? null,
        owned.service_id,
      ]
    );

    const updated = await pool.query(
      `${SERVICE_SELECT} WHERE s.service_id = $1`,
      [owned.service_id]
    );
    res.json(updated.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to update service" });
  }
});

// DELETE /services/:id
router.delete("/:id", requireAuth, requireRole("vendor"), async (req, res) => {
  try {
    const owned = await getOwnedServiceId(req, res);
    if (!owned) return;

    await pool.query(`DELETE FROM services WHERE service_id = $1`, [
      owned.service_id,
    ]);
    res.json({ message: "Service deleted" });
  } catch (err: any) {
    // 23503 = foreign key violation (the service has bookings)
    if (err.code === "23503") {
      res
        .status(409)
        .json({ message: "This service has bookings and cannot be deleted" });
      return;
    }
    console.error(err);
    res.status(500).json({ message: "Failed to delete service" });
  }
});

// ---------- PUBLIC: one service ----------

// GET /services/:id
router.get("/:id", async (req, res) => {
  const id = String(req.params.id);
  if (!uuidSchema.safeParse(id).success) {
    res.status(400).json({ message: "Invalid service id" });
    return;
  }
  try {
    const result = await pool.query(
      `${SERVICE_SELECT} WHERE s.service_id = $1`,
      [id]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ message: "Service not found" });
      return;
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to load service" });
  }
});

export default router;
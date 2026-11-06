import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { pool } from "../db";
import { requireAuth, requireRole } from "../middleware/auth";

const router = Router();

const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(["user", "vendor"]),
  businessName: z.string().min(2).optional(),
  city: z.string().min(2).optional(),
});

const loginSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(1, "Password is required"),
});

function signToken(userId: string, role: string) {
  return jwt.sign({ userId, role }, process.env.JWT_SECRET as string, {
    expiresIn: 60 * 60 * 24 * 7, // 7 days, in seconds
  });
}

// POST /auth/register
router.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      message: parsed.error.issues.map((i) => i.message).join(", "),
    });
    return;
  }

  const { name, password, role, businessName, city } = parsed.data;
  const email = parsed.data.email.toLowerCase();

  if (role === "vendor" && (!businessName || !city)) {
    res
      .status(400)
      .json({ message: "Vendors must provide businessName and city" });
    return;
  }

  const client = await pool.connect();
  try {
    const passwordHash = await bcrypt.hash(password, 10);

    await client.query("BEGIN");

    const userResult = await client.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING user_id, name, email, role`,
      [name, email, passwordHash, role]
    );
    const user = userResult.rows[0];

    // Vendors also get a business profile
    if (role === "vendor") {
      await client.query(
        `INSERT INTO vendors (user_id, business_name, city)
         VALUES ($1, $2, $3)`,
        [user.user_id, businessName, city]
      );
    }

    await client.query("COMMIT");

    const token = signToken(user.user_id, user.role);
    res.status(201).json({ token, user });
  } catch (err: any) {
    await client.query("ROLLBACK");
    if (err.code === "23505") {
      res.status(409).json({ message: "Email already registered" });
      return;
    }
    console.error(err);
    res.status(500).json({ message: "Registration failed" });
  } finally {
    client.release();
  }
});

// POST /auth/login
router.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      message: parsed.error.issues.map((i) => i.message).join(", "),
    });
    return;
  }

  const email = parsed.data.email.toLowerCase();
  const { password } = parsed.data;

  try {
    const result = await pool.query(
      `SELECT user_id, name, email, role, password_hash
       FROM users WHERE email = $1`,
      [email]
    );
    const user = result.rows[0];

    // Same message for both cases, so attackers can't guess which emails exist
    const valid = user && (await bcrypt.compare(password, user.password_hash));
    if (!valid) {
      res.status(401).json({ message: "Invalid email or password" });
      return;
    }

    const token = signToken(user.user_id, user.role);
    res.json({
      token,
      user: {
        user_id: user.user_id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Login failed" });
  }
});

// GET /auth/me  (any logged-in user)
router.get("/me", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT user_id, name, email, role FROM users WHERE user_id = $1`,
      [req.user!.userId]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ message: "User not found" });
      return;
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to load profile" });
  }
});

// GET /auth/vendor-only  (test route, only vendors allowed)
router.get("/vendor-only", requireAuth, requireRole("vendor"), (req, res) => {
  res.json({ message: "Hello vendor, you have access" });
});

export default router;
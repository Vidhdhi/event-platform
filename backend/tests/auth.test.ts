import { describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../src/app";
import { pool } from "../src/db";
import { auth, registerPlanner, registerVendor, uniqueEmail } from "./helpers";

const PASSWORD = "Password123";

describe("Registration", () => {
  it("registers a planner and returns a token", async () => {
    const res = await request(app)
      .post("/auth/register")
      .send({ name: "Ann Planner", email: uniqueEmail("ann"), password: PASSWORD, role: "user" });

    expect(res.status).toBe(201);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.role).toBe("user");
    expect(res.body.user.password_hash).toBeUndefined();
  });

  it("registers a vendor together with a business profile", async () => {
    const vendor = await registerVendor("Ben Vendor", "Kandy");
    // /services/mine only works when a vendor profile exists
    const res = await request(app).get("/services/mine").set(auth(vendor.token));
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("rejects a vendor without a business name", async () => {
    const res = await request(app)
      .post("/auth/register")
      .send({ name: "No Business", email: uniqueEmail("nb"), password: PASSWORD, role: "vendor" });
    expect(res.status).toBe(400);
  });

  it("rejects an invalid email", async () => {
    const res = await request(app)
      .post("/auth/register")
      .send({ name: "Bad Email", email: "not-an-email", password: PASSWORD, role: "user" });
    expect(res.status).toBe(400);
  });

  it("rejects a short password", async () => {
    const res = await request(app)
      .post("/auth/register")
      .send({ name: "Short Pass", email: uniqueEmail("sp"), password: "short", role: "user" });
    expect(res.status).toBe(400);
  });

  it("rejects an invalid role", async () => {
    const res = await request(app)
      .post("/auth/register")
      .send({ name: "Sneaky", email: uniqueEmail("admin"), password: PASSWORD, role: "admin" });
    expect(res.status).toBe(400);
  });

  it("rejects a duplicate email", async () => {
    const body = { name: "First User", email: uniqueEmail("dup"), password: PASSWORD, role: "user" };
    await request(app).post("/auth/register").send(body);
    const res = await request(app).post("/auth/register").send(body);
    expect(res.status).toBe(409);
  });

  it("treats emails as case-insensitive", async () => {
    const email = uniqueEmail("case");
    await request(app)
      .post("/auth/register")
      .send({ name: "Case Test", email, password: PASSWORD, role: "user" });
    const res = await request(app)
      .post("/auth/register")
      .send({ name: "Case Test", email: email.toUpperCase(), password: PASSWORD, role: "user" });
    expect(res.status).toBe(409);
  });

  it("stores passwords hashed, never as plain text", async () => {
    const email = uniqueEmail("hash");
    await request(app)
      .post("/auth/register")
      .send({ name: "Hash Test", email, password: PASSWORD, role: "user" });
    const row = await pool.query("SELECT password_hash FROM users WHERE email = $1", [email]);
    expect(row.rows[0].password_hash).not.toContain(PASSWORD);
    expect(row.rows[0].password_hash.startsWith("$2")).toBe(true);
  });
});

describe("Login", () => {
  it("logs in with the right password", async () => {
    const planner = await registerPlanner();
    const res = await request(app)
      .post("/auth/login")
      .send({ email: planner.email, password: PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.email).toBe(planner.email);
  });

  it("rejects a wrong password", async () => {
    const planner = await registerPlanner();
    const res = await request(app)
      .post("/auth/login")
      .send({ email: planner.email, password: "WrongPassword1" });
    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Invalid email or password");
  });

  it("gives the same answer for an unknown email", async () => {
    const res = await request(app)
      .post("/auth/login")
      .send({ email: "nobody@test.com", password: PASSWORD });
    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Invalid email or password");
  });
});

describe("Protected routes", () => {
  it("rejects requests without a token", async () => {
    const res = await request(app).get("/auth/me");
    expect(res.status).toBe(401);
  });

  it("returns the profile for a valid token", async () => {
    const planner = await registerPlanner();
    const res = await request(app).get("/auth/me").set(auth(planner.token));
    expect(res.status).toBe(200);
    expect(res.body.email).toBe(planner.email);
  });

  it("rejects a malformed token", async () => {
    const res = await request(app).get("/auth/me").set(auth("not.a.token"));
    expect(res.status).toBe(401);
  });

  it("blocks a planner from vendor-only routes", async () => {
    const planner = await registerPlanner();
    const res = await request(app).get("/auth/vendor-only").set(auth(planner.token));
    expect(res.status).toBe(403);
  });

  it("lets a vendor use vendor-only routes", async () => {
    const vendor = await registerVendor();
    const res = await request(app).get("/auth/vendor-only").set(auth(vendor.token));
    expect(res.status).toBe(200);
  });
});
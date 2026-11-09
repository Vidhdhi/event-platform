import { describe, expect, it } from "vitest";
import jwt from "jsonwebtoken";
import request from "supertest";
import { app } from "../src/app";
import { pool } from "../src/db";
import { auth, registerPlanner } from "./helpers";

const FAKE_ID = "00000000-0000-4000-8000-000000000000";

describe("Security", () => {
  it("rejects an expired token", async () => {
    const token = jwt.sign({ userId: FAKE_ID, role: "user" }, process.env.JWT_SECRET as string, {
      expiresIn: -10,
    });
    const res = await request(app).get("/events").set(auth(token));
    expect(res.status).toBe(401);
  });

  it("rejects a token signed with the wrong secret", async () => {
    const token = jwt.sign({ userId: FAKE_ID, role: "user" }, "some-other-secret-value");
    const res = await request(app).get("/events").set(auth(token));
    expect(res.status).toBe(401);
  });

  it("treats a search containing SQL as plain text", async () => {
    const res = await request(app).get("/services").query({ q: "'; DROP TABLE services; --" });
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(0);

    const stillThere = await pool.query("SELECT to_regclass('public.services') AS t");
    expect(stillThere.rows[0].t).toBe("services");
  });

  it("never returns password data", async () => {
    const planner = await registerPlanner();
    const login = await request(app)
      .post("/auth/login")
      .send({ email: planner.email, password: "Password123" });
    const me = await request(app).get("/auth/me").set(auth(planner.token));
    expect(JSON.stringify(login.body).toLowerCase()).not.toContain("password");
    expect(JSON.stringify(me.body).toLowerCase()).not.toContain("password");
  });

  it("answers malformed JSON with a JSON error", async () => {
    const res = await request(app)
      .post("/auth/login")
      .set("Content-Type", "application/json")
      .send("{ this is not json");
    expect(res.status).toBe(400);
    expect(res.body.message).toBeTruthy();
  });

  it("answers unknown routes with a JSON 404", async () => {
    const res = await request(app).get("/does-not-exist");
    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Route not found");
  });

  it("hides the server technology header", async () => {
    const res = await request(app).get("/health");
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });

  it("reports healthy when the database is reachable", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });
});
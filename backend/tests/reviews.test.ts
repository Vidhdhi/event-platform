import { describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../src/app";
import { pool } from "../src/db";
import {
  auth,
  completedBooking,
  registerPlanner,
  requestBooking,
  scenario,
  setStatus,
} from "./helpers";

function review(token: string, serviceId: string, rating: number, comment?: string) {
  return request(app).post("/reviews").set(auth(token)).send({ serviceId, rating, comment });
}

describe("Reviews", () => {
  it("blocks a review when there is no booking", async () => {
    const { planner, service } = await scenario();
    const res = await review(planner.token, service.service_id, 5);
    expect(res.status).toBe(403);
  });

  it("blocks a review while the booking is only accepted", async () => {
    const { planner, vendor, event, service } = await scenario();
    const created = await requestBooking(planner.token, event.event_id, service.service_id);
    await setStatus(vendor.token, created.body.booking_id, "accepted");
    const res = await review(planner.token, service.service_id, 5);
    expect(res.status).toBe(403);
  });

  it("accepts a review after the booking is completed", async () => {
    const { planner, service } = await completedBooking();
    const res = await review(planner.token, service.service_id, 5, "Excellent");
    expect(res.status).toBe(201);
    expect(res.body.rating).toBe(5);
  });

  it("does not let a different planner review the service", async () => {
    const { service } = await completedBooking();
    const stranger = await registerPlanner();
    const res = await review(stranger.token, service.service_id, 5);
    expect(res.status).toBe(403);
  });

  it("edits the review instead of creating a duplicate", async () => {
    const { planner, service } = await completedBooking();
    await review(planner.token, service.service_id, 5);
    const second = await review(planner.token, service.service_id, 4, "Changed my mind");
    expect(second.status).toBe(200);

    const count = await pool.query("SELECT COUNT(*)::int AS n FROM reviews WHERE service_id = $1", [
      service.service_id,
    ]);
    expect(count.rows[0].n).toBe(1);
  });

  it("rejects ratings outside 1 to 5", async () => {
    const { planner, service } = await completedBooking();
    expect((await review(planner.token, service.service_id, 6)).status).toBe(400);
    expect((await review(planner.token, service.service_id, 0)).status).toBe(400);
  });

  it("blocks vendors from posting reviews", async () => {
    const { vendor, service } = await completedBooking();
    const res = await review(vendor.token, service.service_id, 5);
    expect(res.status).toBe(403);
  });

  it("updates the service rating", async () => {
    const { planner, service } = await completedBooking();
    await review(planner.token, service.service_id, 5);
    const res = await request(app).get(`/services/${service.service_id}`);
    expect(res.body.review_count).toBe(1);
    expect(res.body.average_rating).toBe(5);
  });

  it("lists reviews publicly with the reviewer's name", async () => {
    const { planner, service } = await completedBooking();
    await review(planner.token, service.service_id, 4, "Good work");
    const res = await request(app).get(`/reviews/service/${service.service_id}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].reviewer_name).toBe(planner.name);
  });

  it("returns the planner's own reviews", async () => {
    const { planner, service } = await completedBooking();
    await review(planner.token, service.service_id, 3);
    const res = await request(app).get("/reviews/mine").set(auth(planner.token));
    expect(res.body).toHaveLength(1);
    expect(res.body[0].service_id).toBe(service.service_id);
  });

  it("notifies the vendor about a new review", async () => {
    const { planner, vendor, service } = await completedBooking();
    await review(planner.token, service.service_id, 5);
    const res = await request(app).get("/notifications").set(auth(vendor.token));
    expect(res.body.items.some((n: { type: string }) => n.type === "review")).toBe(true);
  });
});
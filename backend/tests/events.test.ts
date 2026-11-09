import { describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../src/app";
import { auth, createEvent, registerPlanner, registerVendor } from "./helpers";

const FULL_EVENT = {
  title: "My Wedding",
  eventType: "wedding",
  eventDate: "2027-03-15T10:00:00Z",
  city: "Colombo",
  guestCount: 150,
  totalBudget: 1_500_000,
};

describe("Events", () => {
  it("creates an event for the logged-in planner", async () => {
    const planner = await registerPlanner();
    const res = await request(app).post("/events").set(auth(planner.token)).send(FULL_EVENT);
    expect(res.status).toBe(201);
    expect(res.body.title).toBe("My Wedding");
    expect(Number(res.body.total_budget)).toBe(1_500_000);
  });

  it("rejects a negative budget", async () => {
    const planner = await registerPlanner();
    const res = await request(app)
      .post("/events")
      .set(auth(planner.token))
      .send({ ...FULL_EVENT, totalBudget: -5 });
    expect(res.status).toBe(400);
  });

  it("rejects an unknown event type", async () => {
    const planner = await registerPlanner();
    const res = await request(app)
      .post("/events")
      .set(auth(planner.token))
      .send({ ...FULL_EVENT, eventType: "concert" });
    expect(res.status).toBe(400);
  });

  it("rejects an empty title", async () => {
    const planner = await registerPlanner();
    const res = await request(app)
      .post("/events")
      .set(auth(planner.token))
      .send({ ...FULL_EVENT, title: "" });
    expect(res.status).toBe(400);
  });

  it("requires login", async () => {
    const res = await request(app).post("/events").send(FULL_EVENT);
    expect(res.status).toBe(401);
  });

  it("blocks vendors from event routes", async () => {
    const vendor = await registerVendor();
    const res = await request(app).get("/events").set(auth(vendor.token));
    expect(res.status).toBe(403);
  });

  it("lists only the planner's own events", async () => {
    const a = await registerPlanner();
    const b = await registerPlanner();
    await createEvent(a.token, { title: "A one" });
    await createEvent(a.token, { title: "A two" });

    const listA = await request(app).get("/events").set(auth(a.token));
    const listB = await request(app).get("/events").set(auth(b.token));
    expect(listA.body).toHaveLength(2);
    expect(listB.body).toHaveLength(0);
  });

  it("hides another planner's event", async () => {
    const owner = await registerPlanner();
    const other = await registerPlanner();
    const event = await createEvent(owner.token);
    const id = event.event_id;

    expect((await request(app).get(`/events/${id}`).set(auth(other.token))).status).toBe(404);
    expect(
      (await request(app).put(`/events/${id}`).set(auth(other.token)).send(FULL_EVENT)).status
    ).toBe(404);
    expect((await request(app).delete(`/events/${id}`).set(auth(other.token))).status).toBe(404);
  });

  it("rejects a malformed event id", async () => {
    const planner = await registerPlanner();
    const res = await request(app).get("/events/not-a-uuid").set(auth(planner.token));
    expect(res.status).toBe(400);
  });

  it("updates an event", async () => {
    const planner = await registerPlanner();
    const event = await createEvent(planner.token);
    const res = await request(app)
      .put(`/events/${event.event_id}`)
      .set(auth(planner.token))
      .send({ ...FULL_EVENT, title: "Updated", city: "Kandy", totalBudget: 1_800_000 });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe("Updated");
    expect(res.body.city).toBe("Kandy");
    expect(Number(res.body.total_budget)).toBe(1_800_000);
  });

  it("deletes an event", async () => {
    const planner = await registerPlanner();
    const event = await createEvent(planner.token);
    const del = await request(app).delete(`/events/${event.event_id}`).set(auth(planner.token));
    expect(del.status).toBe(200);
    const after = await request(app).get(`/events/${event.event_id}`).set(auth(planner.token));
    expect(after.status).toBe(404);
  });
});

describe("Budget", () => {
  it("starts with nothing spent", async () => {
    const planner = await registerPlanner();
    const event = await createEvent(planner.token, { totalBudget: 500_000 });
    const res = await request(app).get(`/events/${event.event_id}/budget`).set(auth(planner.token));
    expect(res.status).toBe(200);
    expect(res.body.totalBudget).toBe(500_000);
    expect(res.body.allocated).toBe(0);
    expect(res.body.remainingBalance).toBe(500_000);
    expect(res.body.overBudget).toBe(false);
  });

  it("subtracts manual expenses", async () => {
    const planner = await registerPlanner();
    const event = await createEvent(planner.token, { totalBudget: 500_000 });
    const add = await request(app)
      .post(`/events/${event.event_id}/budget-items`)
      .set(auth(planner.token))
      .send({ category: "Transport", amount: 50_000, note: "Guest buses" });
    expect(add.status).toBe(201);

    const res = await request(app).get(`/events/${event.event_id}/budget`).set(auth(planner.token));
    expect(res.body.allocated).toBe(50_000);
    expect(res.body.remainingBalance).toBe(450_000);
  });

  it("flags an event that goes over budget", async () => {
    const planner = await registerPlanner();
    const event = await createEvent(planner.token, { totalBudget: 100_000 });
    await request(app)
      .post(`/events/${event.event_id}/budget-items`)
      .set(auth(planner.token))
      .send({ category: "Venue", amount: 150_000 });

    const res = await request(app).get(`/events/${event.event_id}/budget`).set(auth(planner.token));
    expect(res.body.overBudget).toBe(true);
    expect(res.body.remainingBalance).toBe(-50_000);
  });

  it("removes an expense", async () => {
    const planner = await registerPlanner();
    const event = await createEvent(planner.token);
    const add = await request(app)
      .post(`/events/${event.event_id}/budget-items`)
      .set(auth(planner.token))
      .send({ category: "Transport", amount: 20_000 });

    const del = await request(app)
      .delete(`/events/${event.event_id}/budget-items/${add.body.item_id}`)
      .set(auth(planner.token));
    expect(del.status).toBe(200);

    const res = await request(app).get(`/events/${event.event_id}/budget`).set(auth(planner.token));
    expect(res.body.allocated).toBe(0);
  });

  it("rejects a negative expense", async () => {
    const planner = await registerPlanner();
    const event = await createEvent(planner.token);
    const res = await request(app)
      .post(`/events/${event.event_id}/budget-items`)
      .set(auth(planner.token))
      .send({ category: "Transport", amount: -1 });
    expect(res.status).toBe(400);
  });
});
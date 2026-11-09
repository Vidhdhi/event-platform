import { describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../src/app";
import {
  auth,
  createEvent,
  createService,
  registerPlanner,
  registerVendor,
  requestBooking,
  scenario,
  setStatus,
} from "./helpers";

describe("Booking requests", () => {
  it("lets a planner send a request, which starts as pending", async () => {
    const { planner, event, service } = await scenario();
    const res = await requestBooking(planner.token, event.event_id, service.service_id, "Hello");
    expect(res.status).toBe(201);
    expect(res.body.status).toBe("pending");
  });

  it("blocks a duplicate request while one is pending", async () => {
    const { planner, event, service } = await scenario();
    await requestBooking(planner.token, event.event_id, service.service_id);
    const again = await requestBooking(planner.token, event.event_id, service.service_id);
    expect(again.status).toBe(409);
  });

  it("blocks vendors from creating bookings", async () => {
    const { vendor, event, service } = await scenario();
    const res = await requestBooking(vendor.token, event.event_id, service.service_id);
    expect(res.status).toBe(403);
  });

  it("blocks a booking for an event the planner does not own", async () => {
    const { event, service } = await scenario();
    const stranger = await registerPlanner();
    const res = await requestBooking(stranger.token, event.event_id, service.service_id);
    expect(res.status).toBe(404);
  });

  it("rejects malformed ids and missing login", async () => {
    const planner = await registerPlanner();
    const bad = await requestBooking(planner.token, "nope", "nope");
    const anon = await request(app).get("/bookings");
    expect(bad.status).toBe(400);
    expect(anon.status).toBe(401);
  });

  it("shows the request to the owning vendor and the planner only", async () => {
    const { planner, vendor, event, service } = await scenario();
    const otherVendor = await registerVendor();
    await requestBooking(planner.token, event.event_id, service.service_id);

    const forVendor = await request(app).get("/bookings").set(auth(vendor.token));
    const forPlanner = await request(app).get("/bookings").set(auth(planner.token));
    const forOther = await request(app).get("/bookings").set(auth(otherVendor.token));
    expect(forVendor.body).toHaveLength(1);
    expect(forPlanner.body).toHaveLength(1);
    expect(forOther.body).toHaveLength(0);
  });
});

describe("Booking decisions", () => {
  it("lets the vendor accept, using the listed price", async () => {
    const { planner, vendor, event, service } = await scenario({ price: 100_000 });
    const created = await requestBooking(planner.token, event.event_id, service.service_id);
    const res = await setStatus(vendor.token, created.body.booking_id, "accepted");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("accepted");
    expect(res.body.agreed_price).toBe(100_000);

    const budget = await request(app)
      .get(`/events/${event.event_id}/budget`)
      .set(auth(planner.token));
    expect(budget.body.allocated).toBe(100_000);
  });

  it("lets the vendor agree a different price", async () => {
    const { planner, vendor, event, service } = await scenario({ price: 100_000 });
    const created = await requestBooking(planner.token, event.event_id, service.service_id);
    const res = await setStatus(vendor.token, created.body.booking_id, "accepted", {
      agreedPrice: 90_000,
    });
    expect(res.body.agreed_price).toBe(90_000);

    const budget = await request(app)
      .get(`/events/${event.event_id}/budget`)
      .set(auth(planner.token));
    expect(budget.body.allocated).toBe(90_000);
  });

  it("reports when accepting puts the event over budget", async () => {
    const { planner, vendor, event, service } = await scenario({ price: 5_000, budget: 1_000 });
    const created = await requestBooking(planner.token, event.event_id, service.service_id);
    const res = await setStatus(vendor.token, created.body.booking_id, "accepted");
    expect(res.body.eventOverBudget).toBe(true);
  });

  it("lets the vendor decline", async () => {
    const { planner, vendor, event, service } = await scenario();
    const created = await requestBooking(planner.token, event.event_id, service.service_id);
    const res = await setStatus(vendor.token, created.body.booking_id, "rejected");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("rejected");
  });

  it("does not let a planner accept their own request", async () => {
    const { planner, event, service } = await scenario();
    const created = await requestBooking(planner.token, event.event_id, service.service_id);
    const res = await setStatus(planner.token, created.body.booking_id, "accepted");
    expect(res.status).toBe(400);
  });

  it("does not let another vendor change the booking", async () => {
    const { planner, event, service } = await scenario();
    const other = await registerVendor();
    const created = await requestBooking(planner.token, event.event_id, service.service_id);
    const res = await setStatus(other.token, created.body.booking_id, "accepted");
    expect(res.status).toBe(404);
  });

  it("does not allow moving a completed booking back", async () => {
    const { planner, vendor, event, service } = await scenario();
    const created = await requestBooking(planner.token, event.event_id, service.service_id);
    const id = created.body.booking_id;
    await setStatus(vendor.token, id, "accepted");
    await setStatus(vendor.token, id, "completed");
    const res = await setStatus(vendor.token, id, "accepted");
    expect(res.status).toBe(400);
  });

  it("rejects a malformed booking id", async () => {
    const vendor = await registerVendor();
    const res = await setStatus(vendor.token, "not-a-uuid", "accepted");
    expect(res.status).toBe(400);
  });

  it("blocks two accepted bookings for one service on the same date", async () => {
    const planner = await registerPlanner();
    const vendor = await registerVendor();
    const service = await createService(vendor.token);
    const date = "2027-06-20T10:00:00Z";
    const eventOne = await createEvent(planner.token, { title: "First", eventDate: date });
    const eventTwo = await createEvent(planner.token, { title: "Second", eventDate: date });

    const first = await requestBooking(planner.token, eventOne.event_id, service.service_id);
    const second = await requestBooking(planner.token, eventTwo.event_id, service.service_id);

    const ok = await setStatus(vendor.token, first.body.booking_id, "accepted");
    const clash = await setStatus(vendor.token, second.body.booking_id, "accepted");
    expect(ok.status).toBe(200);
    expect(clash.status).toBe(409);
  });
});

describe("Cancelling and re-requesting", () => {
  it("lets a planner cancel an accepted booking and frees the budget", async () => {
    const { planner, vendor, event, service } = await scenario({ price: 100_000 });
    const created = await requestBooking(planner.token, event.event_id, service.service_id);
    const id = created.body.booking_id;
    await setStatus(vendor.token, id, "accepted");

    const cancel = await setStatus(planner.token, id, "cancelled");
    expect(cancel.status).toBe(200);

    const budget = await request(app)
      .get(`/events/${event.event_id}/budget`)
      .set(auth(planner.token));
    expect(budget.body.allocated).toBe(0);
  });

  it("lets the planner request again after a decline", async () => {
    const { planner, vendor, event, service } = await scenario();
    const first = await requestBooking(planner.token, event.event_id, service.service_id);
    await setStatus(vendor.token, first.body.booking_id, "rejected");

    const again = await requestBooking(
      planner.token,
      event.event_id,
      service.service_id,
      "Please reconsider"
    );
    expect(again.status).toBe(201);
    expect(again.body.status).toBe("pending");
  });

  it("refuses to delete a service that has bookings", async () => {
    const { planner, vendor, event, service } = await scenario();
    await requestBooking(planner.token, event.event_id, service.service_id);
    const res = await request(app)
      .delete(`/services/${service.service_id}`)
      .set(auth(vendor.token));
    expect(res.status).toBe(409);
  });
});

describe("Notifications", () => {
  it("notifies the vendor of a request and the planner of the answer", async () => {
    const { planner, vendor, event, service } = await scenario();
    const created = await requestBooking(planner.token, event.event_id, service.service_id);

    const vendorBefore = await request(app).get("/notifications").set(auth(vendor.token));
    expect(vendorBefore.body.unreadCount).toBe(1);
    expect(vendorBefore.body.items[0].type).toBe("booking_request");

    await setStatus(vendor.token, created.body.booking_id, "accepted");
    const plannerAfter = await request(app).get("/notifications").set(auth(planner.token));
    expect(plannerAfter.body.items[0].type).toBe("booking_accepted");
  });

  it("marks a notification as read", async () => {
    const { planner, vendor, event, service } = await scenario();
    await requestBooking(planner.token, event.event_id, service.service_id);
    const list = await request(app).get("/notifications").set(auth(vendor.token));
    const id = list.body.items[0].notification_id;

    const read = await request(app).patch(`/notifications/${id}/read`).set(auth(vendor.token));
    expect(read.status).toBe(200);
    const after = await request(app).get("/notifications").set(auth(vendor.token));
    expect(after.body.unreadCount).toBe(0);
  });

  it("does not let a user read someone else's notification", async () => {
    const { planner, vendor, event, service } = await scenario();
    await requestBooking(planner.token, event.event_id, service.service_id);
    const list = await request(app).get("/notifications").set(auth(vendor.token));
    const id = list.body.items[0].notification_id;

    const res = await request(app).patch(`/notifications/${id}/read`).set(auth(planner.token));
    expect(res.status).toBe(404);
  });

  it("marks everything as read", async () => {
    const { planner, vendor, event, service } = await scenario();
    await requestBooking(planner.token, event.event_id, service.service_id);
    await request(app).post("/notifications/read-all").set(auth(vendor.token));
    const after = await request(app).get("/notifications").set(auth(vendor.token));
    expect(after.body.unreadCount).toBe(0);
  });
});
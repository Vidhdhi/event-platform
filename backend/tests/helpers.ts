import request from "supertest";
import { app } from "../src/app";
import { pool } from "../src/db";

type Json = Record<string, any>;

let counter = 0;

export function uniqueEmail(prefix = "user") {
  counter += 1;
  return `${prefix}.${Date.now()}.${counter}@test.com`;
}

export const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

// Empties every table. Refuses to run unless the database name contains "_test".
export async function resetDb() {
  const url = process.env.DATABASE_URL ?? "";
  if (!url.includes("_test")) {
    throw new Error("Refusing to reset a database that is not a test database");
  }
  await pool.query(
    "TRUNCATE notifications, budget_items, reviews, bookings, events, services, vendors, users CASCADE"
  );
}

export async function registerPlanner(name = "Test Planner") {
  const email = uniqueEmail("planner");
  const res = await request(app)
    .post("/auth/register")
    .send({ name, email, password: "Password123", role: "user" });
  if (res.status !== 201) {
    throw new Error(`registerPlanner failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return { token: res.body.token as string, userId: res.body.user.user_id as string, email, name };
}

export async function registerVendor(name = "Test Vendor", city = "Colombo") {
  const email = uniqueEmail("vendor");
  const res = await request(app).post("/auth/register").send({
    name,
    email,
    password: "Password123",
    role: "vendor",
    businessName: `${name} Business`,
    city,
  });
  if (res.status !== 201) {
    throw new Error(`registerVendor failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return { token: res.body.token as string, userId: res.body.user.user_id as string, email };
}

export async function createEvent(token: string, overrides: Json = {}): Promise<Json> {
  const res = await request(app)
    .post("/events")
    .set(auth(token))
    .send({
      title: "Test Wedding",
      eventType: "wedding",
      eventDate: "2027-03-15T10:00:00Z",
      city: "Colombo",
      guestCount: 100,
      totalBudget: 1_000_000,
      ...overrides,
    });
  if (res.status !== 201) {
    throw new Error(`createEvent failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body;
}

export async function createService(token: string, overrides: Json = {}): Promise<Json> {
  const res = await request(app)
    .post("/services")
    .set(auth(token))
    .send({
      category: "Photography",
      title: "Test Photography",
      description: "Wedding photography",
      price: 100_000,
      ...overrides,
    });
  if (res.status !== 201) {
    throw new Error(`createService failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body;
}

export function requestBooking(
  plannerToken: string,
  eventId: string,
  serviceId: string,
  message?: string
) {
  return request(app)
    .post("/bookings")
    .set(auth(plannerToken))
    .send({ eventId, serviceId, message });
}

export function setStatus(token: string, bookingId: string, status: string, extra: Json = {}) {
  return request(app)
    .patch(`/bookings/${bookingId}/status`)
    .set(auth(token))
    .send({ status, ...extra });
}

// A planner with an event, and a vendor with a service
export async function scenario(
  opts: { price?: number; budget?: number; eventDate?: string } = {}
) {
  const planner = await registerPlanner();
  const vendor = await registerVendor();
  const event = await createEvent(planner.token, {
    totalBudget: opts.budget ?? 1_000_000,
    ...(opts.eventDate ? { eventDate: opts.eventDate } : {}),
  });
  const service = await createService(vendor.token, { price: opts.price ?? 100_000 });
  return { planner, vendor, event, service };
}

// A booking that reached the "completed" status
export async function completedBooking() {
  const s = await scenario();
  const created = await requestBooking(s.planner.token, s.event.event_id, s.service.service_id);
  const bookingId = created.body.booking_id as string;
  await setStatus(s.vendor.token, bookingId, "accepted");
  await setStatus(s.vendor.token, bookingId, "completed");
  return { ...s, bookingId };
}
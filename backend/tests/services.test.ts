import { beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../src/app";
import { auth, createService, registerPlanner, registerVendor } from "./helpers";

describe("Vendor services", () => {
  it("creates a service and defaults the city to the vendor's city", async () => {
    const vendor = await registerVendor("City Vendor", "Kandy");
    const res = await request(app)
      .post("/services")
      .set(auth(vendor.token))
      .send({ category: "Catering", title: "Wedding buffet", price: 250_000 });
    expect(res.status).toBe(201);
    expect(res.body.city).toBe("Kandy");
    expect(res.body.price).toBe(250_000);
    expect(res.body.review_count).toBe(0);
  });

  it("blocks planners from creating services", async () => {
    const planner = await registerPlanner();
    const res = await request(app)
      .post("/services")
      .set(auth(planner.token))
      .send({ category: "Catering", title: "Sneaky service", price: 1000 });
    expect(res.status).toBe(403);
  });

  it("requires login to create a service", async () => {
    const res = await request(app)
      .post("/services")
      .send({ category: "Catering", title: "No login", price: 1000 });
    expect(res.status).toBe(401);
  });

  it("rejects a negative price", async () => {
    const vendor = await registerVendor();
    const res = await request(app)
      .post("/services")
      .set(auth(vendor.token))
      .send({ category: "Catering", title: "Negative price", price: -10 });
    expect(res.status).toBe(400);
  });

  it("rejects an unknown category", async () => {
    const vendor = await registerVendor();
    const res = await request(app)
      .post("/services")
      .set(auth(vendor.token))
      .send({ category: "Cars", title: "Wrong category", price: 1000 });
    expect(res.status).toBe(400);
  });

  it("lists only the vendor's own services under /mine", async () => {
    const a = await registerVendor("Vendor A");
    const b = await registerVendor("Vendor B");
    await createService(a.token, { title: "A service" });
    await createService(b.token, { title: "B service one" });
    await createService(b.token, { title: "B service two" });

    const resA = await request(app).get("/services/mine").set(auth(a.token));
    const resB = await request(app).get("/services/mine").set(auth(b.token));
    expect(resA.body).toHaveLength(1);
    expect(resB.body).toHaveLength(2);
  });

  it("updates only the fields that are sent", async () => {
    const vendor = await registerVendor();
    const service = await createService(vendor.token, { title: "Original title", price: 100_000 });
    const res = await request(app)
      .put(`/services/${service.service_id}`)
      .set(auth(vendor.token))
      .send({ price: 160_000 });
    expect(res.status).toBe(200);
    expect(res.body.price).toBe(160_000);
    expect(res.body.title).toBe("Original title");
  });

  it("does not let another vendor edit or delete a service", async () => {
    const owner = await registerVendor();
    const other = await registerVendor();
    const service = await createService(owner.token);
    const id = service.service_id;

    const edit = await request(app).put(`/services/${id}`).set(auth(other.token)).send({ price: 1 });
    const del = await request(app).delete(`/services/${id}`).set(auth(other.token));
    expect(edit.status).toBe(404);
    expect(del.status).toBe(404);
  });

  it("deletes a service", async () => {
    const vendor = await registerVendor();
    const service = await createService(vendor.token);
    const del = await request(app).delete(`/services/${service.service_id}`).set(auth(vendor.token));
    expect(del.status).toBe(200);
    const after = await request(app).get(`/services/${service.service_id}`);
    expect(after.status).toBe(404);
  });

  it("shows a service to anyone, without logging in", async () => {
    const vendor = await registerVendor();
    const service = await createService(vendor.token, { title: "Public service" });
    const res = await request(app).get(`/services/${service.service_id}`);
    expect(res.status).toBe(200);
    expect(res.body.title).toBe("Public service");
  });

  it("returns 404 for an unknown service and 400 for a malformed id", async () => {
    const unknown = await request(app).get("/services/00000000-0000-4000-8000-000000000000");
    const malformed = await request(app).get("/services/not-a-uuid");
    expect(unknown.status).toBe(404);
    expect(malformed.status).toBe(400);
  });

  it("lists the categories", async () => {
    const res = await request(app).get("/services/categories");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(7);
  });
});

// Every search below adds q=Zephyr so other tests' services never interfere
describe("Search and filtering", () => {
  beforeAll(async () => {
    const vendor = await registerVendor("Search Vendor", "Colombo");
    await createService(vendor.token, { category: "Photography", title: "Zephyr Studio", price: 50_000, city: "Colombo" });
    await createService(vendor.token, { category: "Photography", title: "Zephyr Lens", price: 150_000, city: "Kandy" });
    await createService(vendor.token, { category: "Catering", title: "Zephyr Catering", price: 300_000, city: "Colombo" });
    await createService(vendor.token, { category: "Venue", title: "Zephyr Hall", price: 500_000, city: "Galle" });
  });

  const search = (query: string) => request(app).get(`/services?q=Zephyr&${query}`);

  it("finds services by keyword", async () => {
    const res = await search("");
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(4);
  });

  it("filters by category", async () => {
    const res = await search("category=Photography");
    expect(res.body.total).toBe(2);
  });

  it("filters by maximum price", async () => {
    const res = await search("maxPrice=150000");
    expect(res.body.total).toBe(2);
  });

  it("filters by minimum price", async () => {
    const res = await search("minPrice=200000");
    expect(res.body.total).toBe(2);
  });

  it("filters by city, ignoring capital letters", async () => {
    const res = await search("city=colombo");
    expect(res.body.total).toBe(2);
  });

  it("combines filters", async () => {
    const res = await search("category=Photography&city=Colombo&maxPrice=100000");
    expect(res.body.total).toBe(1);
    expect(res.body.data[0].title).toBe("Zephyr Studio");
  });

  it("sorts by price", async () => {
    const asc = await search("sort=price_asc");
    const desc = await search("sort=price_desc");
    expect(asc.body.data[0].price).toBe(50_000);
    expect(desc.body.data[0].price).toBe(500_000);
  });

  it("pages the results", async () => {
    const first = await search("limit=3&page=1");
    const second = await search("limit=3&page=2");
    expect(first.body.data).toHaveLength(3);
    expect(first.body.totalPages).toBe(2);
    expect(second.body.data).toHaveLength(1);
  });

  it("returns an empty list when nothing matches", async () => {
    const res = await search("minRating=4");
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(0);
    expect(res.body.data).toEqual([]);
  });

  it("rejects a bad sort value or rating", async () => {
    expect((await search("sort=cheapest")).status).toBe(400);
    expect((await search("minRating=6")).status).toBe(400);
  });
});
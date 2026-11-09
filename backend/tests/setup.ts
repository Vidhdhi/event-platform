import { afterAll, beforeAll } from "vitest";
import { pool } from "../src/db";
import { resetDb } from "./helpers";

beforeAll(async () => {
  await resetDb();
});

afterAll(async () => {
  await pool.end();
});
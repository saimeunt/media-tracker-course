import assert from "node:assert/strict";
import { test } from "node:test";
import { startApi } from "./helpers.ts";

const api = startApi();

test("GET /api/health returns ok", async () => {
  const res = await api("/api/health");
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true });
});

test("unknown URLs return a 404 problem", async () => {
  const res = await api("/api/nope");
  assert.equal(res.status, 404);
  assert.equal(res.headers.get("content-type"), "application/problem+json; charset=utf-8");
  assert.deepEqual(await res.json(), {
    type: "about:blank",
    title: "Not Found",
    status: 404,
    detail: "No route for GET /api/nope",
  });
});

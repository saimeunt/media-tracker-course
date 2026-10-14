import assert from "node:assert/strict";
import { test } from "node:test";
import { startApi } from "./helpers.ts";

const ALLOWED = "http://localhost:8080";
const api = startApi({ corsOrigins: [ALLOWED] });

test("a preflight from an allowed origin is answered with 204 and the allowed methods", async () => {
  const res = await api("/api/lists", {
    method: "OPTIONS",
    headers: { Origin: ALLOWED, "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type" },
  });
  assert.equal(res.status, 204);
  assert.equal(res.headers.get("access-control-allow-origin"), ALLOWED);
  assert.equal(res.headers.get("access-control-allow-credentials"), "true");
  assert.match(res.headers.get("access-control-allow-methods")!, /POST/);
  assert.match(res.headers.get("access-control-allow-headers")!, /Content-Type/);
});

test("a request from an allowed origin gets Access-Control-Allow-Origin", async () => {
  const res = await api("/api/health", { headers: { Origin: ALLOWED } });
  assert.equal(res.headers.get("access-control-allow-origin"), ALLOWED);
  assert.equal(res.headers.get("vary"), "Origin");
});

test("other origins get no CORS headers, so the browser blocks the response", async () => {
  const res = await api("/api/health", { headers: { Origin: "https://evil.example" } });
  // The server still answers: CORS is enforced by the browser, not the server.
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("access-control-allow-origin"), null);
});

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { CurrentUser, ProblemDetails } from "@media-tracker/shared";
import { ALICE, json, signIn, startApi } from "./helpers.ts";

const api = startApi();
const credentials = { email: ALICE.email, password: ALICE.password };

describe("POST /api/auth/register", () => {
  test("creates the user and signs them in with an HttpOnly cookie", async () => {
    const res = await api("/api/auth/register", json("POST", { username: "Carol", email: "Carol@Example.com", password: "s3cret-pass" }));
    assert.equal(res.status, 201);
    const user = (await res.json()) as CurrentUser;
    assert.equal(user.username, "carol");
    assert.equal(user.email, "carol@example.com");
    assert.ok(!("passwordHash" in user));
    assert.equal(res.headers.get("location"), `/api/users/${user.id}`);

    const cookie = res.headers.getSetCookie()[0]!;
    assert.match(cookie, /^token=[\w-]+\.[\w-]+\.[\w-]+;/);
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /SameSite=Lax/);

    const me = await api("/api/auth/me", { headers: { Cookie: cookie.split(";")[0]! } });
    assert.deepEqual(await me.json(), user);
  });

  test("409 when the username or email is taken", async () => {
    const res = await api("/api/auth/register", json("POST", { username: "alice", email: "new@example.com", password: "s3cret-pass" }));
    assert.equal(res.status, 409);
    assert.equal(((await res.json()) as ProblemDetails).errors?.[0]?.pointer, "#/username");
    const email = await api("/api/auth/register", json("POST", { username: "new_user", email: ALICE.email, password: "s3cret-pass" }));
    assert.equal(email.status, 409);
  });

  test("[R3] 422 on invalid fields", async () => {
    const res = await api("/api/auth/register", json("POST", { username: "a b", email: "nope", password: "short" }));
    assert.equal(res.status, 422);
    const pointers = ((await res.json()) as ProblemDetails).errors?.map((e) => e.pointer).sort();
    assert.deepEqual(pointers, ["#/email", "#/password", "#/username"]);
  });
});

describe("POST /api/auth/login", () => {
  test("signs in with the right password", async () => {
    const res = await api("/api/auth/login", json("POST", credentials));
    assert.equal(res.status, 200);
    assert.equal(((await res.json()) as CurrentUser).username, "alice");
    assert.match(res.headers.getSetCookie()[0]!, /^token=/);
  });

  test("401 with the same message for a wrong password and an unknown email", async () => {
    const wrong = await api("/api/auth/login", json("POST", { ...credentials, password: "wrong-password" }));
    const unknown = await api("/api/auth/login", json("POST", { email: "nobody@example.com", password: "password123" }));
    assert.equal(wrong.status, 401);
    assert.equal(unknown.status, 401);
    assert.equal(wrong.headers.getSetCookie().length, 0);
    assert.deepEqual(await wrong.json(), await unknown.json());
  });
});

describe("GET /api/auth/me", () => {
  test("401 when signed out", async () => {
    assert.equal((await api("/api/auth/me")).status, 401);
  });

  test("works with the cookie or with a Bearer token", async () => {
    const headers = await signIn(api, ALICE);
    assert.equal((await api("/api/auth/me", { headers })).status, 200);
    const token = headers.Cookie.slice("token=".length);
    assert.equal((await api("/api/auth/me", { headers: { Authorization: `Bearer ${token}` } })).status, 200);
  });

  test("401 when the token was tampered with", async () => {
    const { Cookie } = await signIn(api, ALICE);
    const [header, payload, signature] = Cookie.slice("token=".length).split(".");
    // Claim to be someone else: the signature no longer matches.
    const forged = Buffer.from(JSON.stringify({ sub: "66f4a1000000000000000002" })).toString("base64url");
    assert.notEqual(forged, payload);
    const res = await api("/api/auth/me", { headers: { Cookie: `token=${header}.${forged}.${signature}` } });
    assert.equal(res.status, 401);
  });
});

test("POST /api/auth/logout clears the cookie", async () => {
  const res = await api("/api/auth/logout", { method: "POST" });
  assert.equal(res.status, 204);
  assert.match(res.headers.getSetCookie()[0]!, /^token=;.*Expires=Thu, 01 Jan 1970/);
});

test("GET /api/users/:id returns the public profile only", async () => {
  const res = await api(`/api/users/${ALICE.id}`);
  assert.equal(res.status, 200);
  assert.deepEqual(Object.keys(await res.json()).sort(), ["createdAt", "id", "username"]);
});

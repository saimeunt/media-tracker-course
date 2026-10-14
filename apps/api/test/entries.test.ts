import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import type { Entry, Media, OffsetPage, ProblemDetails, UserStats } from "@media-tracker/shared";
import { ALICE, BOB, json, signIn, startApi } from "./helpers.ts";

const api = startApi();

let alice: Record<string, string> = {};
before(async () => {
  alice = await signIn(api, ALICE);
});

const entryUrl = (mediaId: string) => `/api/users/${ALICE.id}/entries/${mediaId}`;
const stats = async (mediaId: string) => ((await (await api(`/api/media/${mediaId}`)).json()) as Media).stats;

describe("GET /api/users/:id/entries", () => {
  test("lists a library, most recently updated first", async () => {
    const res = await api(`/api/users/${ALICE.id}/entries`);
    assert.equal(res.status, 200);
    const body = (await res.json()) as OffsetPage<Entry>;
    assert.deepEqual(body.items.map((e) => e.title), ["Neuromancer", "Inception", "Memento", "Portal 2"]);
  });

  test("filters by status and type", async () => {
    const res = await api(`/api/users/${ALICE.id}/entries?status=completed&type=movie`);
    const body = (await res.json()) as OffsetPage<Entry>;
    assert.equal(body.total, 2);
  });

  test("404 for an unknown user", async () => {
    assert.equal((await api("/api/users/000000000000000000000000/entries")).status, 404);
  });
});

describe("PUT /api/users/:id/entries/:mediaId", () => {
  test("[M3] creates an entry (201), then replaces it (200), keeping the media's stats in sync", async () => {
    assert.deepEqual(await stats("Q83495"), { entryCount: 0, ratingCount: 0, averageRating: null });

    const created = await api(entryUrl("Q83495"), json("PUT", { status: "completed", rating: 9 }, alice));
    assert.equal(created.status, 201);
    assert.equal(created.headers.get("location"), entryUrl("Q83495"));
    const entry = (await created.json()) as Entry;
    assert.deepEqual([entry.title, entry.status, entry.rating, entry.review], ["The Matrix", "completed", 9, null]);
    assert.deepEqual(await stats("Q83495"), { entryCount: 1, ratingCount: 1, averageRating: 9 });

    const replaced = await api(entryUrl("Q83495"), json("PUT", { status: "completed", rating: 7, review: "Less than I remembered" }, alice));
    assert.equal(replaced.status, 200);
    assert.equal(((await replaced.json()) as Entry).createdAt, entry.createdAt);
    assert.deepEqual(await stats("Q83495"), { entryCount: 1, ratingCount: 1, averageRating: 7 });

    // PUT replaces the whole entry: leaving the rating out clears it.
    await api(entryUrl("Q83495"), json("PUT", { status: "dropped" }, alice));
    assert.deepEqual(await stats("Q83495"), { entryCount: 1, ratingCount: 0, averageRating: null });
  });

  test("[M3] updates the average with other users' ratings", async () => {
    // Inception: bob rated it 6. Alice changes her 9 into a 10.
    await api(entryUrl("Q25188"), json("PUT", { status: "completed", rating: 10 }, alice));
    assert.deepEqual(await stats("Q25188"), { entryCount: 2, ratingCount: 2, averageRating: 8 });
  });

  test("[R3] 422 on an invalid rating or status", async () => {
    const res = await api(entryUrl("Q83495"), json("PUT", { status: "watched", rating: 11 }, alice));
    assert.equal(res.status, 422);
    const pointers = ((await res.json()) as ProblemDetails).errors?.map((e) => e.pointer).sort();
    assert.deepEqual(pointers, ["#/rating", "#/status"]);
  });

  test("401 signed out, 403 in someone else's library, 404 for an unknown media", async () => {
    assert.equal((await api(entryUrl("Q83495"), json("PUT", { status: "planned" }))).status, 401);
    const bobs = `/api/users/${BOB.id}/entries/Q83495`;
    assert.equal((await api(bobs, json("PUT", { status: "planned" }, alice))).status, 403);
    assert.equal((await api(entryUrl("Q0"), json("PUT", { status: "planned" }, alice))).status, 404);
  });
});

describe("DELETE /api/users/:id/entries/:mediaId", () => {
  test("[M3] removes the entry and its rating from the stats: 204, then 404", async () => {
    await api(entryUrl("Q20382729"), json("PUT", { status: "completed", rating: 8 }, alice));
    assert.equal((await stats("Q20382729")).ratingCount, 1);
    assert.equal((await api(entryUrl("Q20382729"), { method: "DELETE", headers: alice })).status, 204);
    assert.deepEqual(await stats("Q20382729"), { entryCount: 0, ratingCount: 0, averageRating: null });
    assert.equal((await api(entryUrl("Q20382729"), { method: "DELETE", headers: alice })).status, 404);
  });
});

test("GET /api/users/:id/stats summarizes a library", async () => {
  const res = await api(`/api/users/${BOB.id}/stats`);
  assert.equal(res.status, 200);
  const body = (await res.json()) as UserStats;
  assert.equal(body.entryCount, 3);
  assert.equal(body.averageRating, 7);
  assert.deepEqual(body.byStatus, { planned: 0, in_progress: 0, completed: 2, dropped: 1 });
  assert.deepEqual(body.byType.find((t) => t.type === "series"), { type: "series", entryCount: 2, completedCount: 1, averageRating: 7.5 });
  assert.deepEqual(body.byType.find((t) => t.type === "book"), { type: "book", entryCount: 0, completedCount: 0, averageRating: null });
});

import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import type { List, ListItem, ListSummary, OffsetPage, ProblemDetails } from "@media-tracker/shared";
import { ALICE, BOB, json as jsonAs, signIn, startApi } from "./helpers.ts";

const api = startApi();

// From the fixtures.
const ALICE_PRIVATE_LIST = "66f4a2000000000000000002";
const BOB_LIST = "66f4a2000000000000000003";

// Most requests are sent as alice.
let alice: Record<string, string> = {};
let bob: Record<string, string> = {};
before(async () => {
  alice = await signIn(api, ALICE);
  bob = await signIn(api, BOB);
});
const json = (method: string, body: unknown) => jsonAs(method, body, alice);
const as = (headers: Record<string, string>, init: RequestInit = {}): RequestInit => ({
  ...init,
  headers: { ...(init.headers as Record<string, string>), ...headers },
});

async function createList(body: unknown = { name: "Favourites" }) {
  const res = await api("/api/lists", json("POST", body));
  assert.equal(res.status, 201);
  return { list: (await res.json()) as List, location: res.headers.get("location") };
}

describe("[M2] GET /api/lists", () => {
  test("returns list summaries, most recently updated first, with offset pagination", async () => {
    const res = await api("/api/lists?limit=2");
    assert.equal(res.status, 200);
    const body = (await res.json()) as OffsetPage<ListSummary>;
    assert.equal(body.page, 1);
    assert.equal(body.limit, 2);
    assert.equal(body.total, 2);
    assert.equal(body.items.length, 2);
    assert.equal(body.items[0]!.name, "Binge-worthy");
    assert.equal(body.items[0]!.itemCount, 2);
    assert.ok(!("items" in body.items[0]!));
  });

  test("includes private lists for their owner only", async () => {
    const res = await api(`/api/lists?ownerId=${ALICE.id}`, as(alice));
    const body = (await res.json()) as OffsetPage<ListSummary>;
    assert.ok(body.items.some((l) => l.visibility === "private"));
    const anonymous = (await (await api(`/api/lists?ownerId=${ALICE.id}`)).json()) as OffsetPage<ListSummary>;
    assert.ok(anonymous.items.every((l) => l.visibility === "public"));
  });

  test("filters by owner", async () => {
    const body = (await (await api(`/api/lists?ownerId=${ALICE.id}`)).json()) as OffsetPage<ListSummary>;
    assert.ok(body.items.every((l) => l.ownerId === ALICE.id));
  });
});

describe("[M2] POST /api/lists", () => {
  test("creates a list: 201 with a Location header", async () => {
    const { list, location } = await createList({ name: "  Comfort reads  ", visibility: "private" });
    assert.equal(location, `/api/lists/${list.id}`);
    assert.equal(list.name, "Comfort reads");
    assert.equal(list.description, "");
    assert.equal(list.visibility, "private");
    assert.equal(list.ownerId, ALICE.id);
    assert.deepEqual(list.items, []);

    const res = await api(location!, as(alice));
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), list);
  });

  test("[R3] rejects an invalid body with a 422 problem pointing at each field", async () => {
    const res = await api("/api/lists", json("POST", { name: "", visibility: "secret", ownerId: "someone" }));
    assert.equal(res.status, 422);
    const problem = (await res.json()) as ProblemDetails;
    assert.deepEqual(problem.errors?.map((e) => e.pointer).sort(), ["#", "#/name", "#/visibility"]);
  });

  test("rejects malformed JSON with 400", async () => {
    const res = await api("/api/lists", as(alice, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{name:" }));
    assert.equal(res.status, 400);
    assert.equal(((await res.json()) as ProblemDetails).detail, "The request body is not valid JSON");
  });

  test("rejects a body that isn't JSON with 415", async () => {
    const res = await api("/api/lists", as(alice, { method: "POST", body: "name=Favourites" }));
    assert.equal(res.status, 415);
  });
});

describe("[M2] GET /api/lists/:id", () => {
  test("returns 404 for an unknown id", async () => {
    assert.equal((await api("/api/lists/000000000000000000000000")).status, 404);
  });

  test("returns a private list to its owner only: 404 for everyone else", async () => {
    assert.equal((await api(`/api/lists/${ALICE_PRIVATE_LIST}`, as(alice))).status, 200);
    assert.equal((await api(`/api/lists/${ALICE_PRIVATE_LIST}`, as(bob))).status, 404);
    assert.equal((await api(`/api/lists/${ALICE_PRIVATE_LIST}`)).status, 404);
  });
});

describe("[R2] [M2] PATCH and DELETE /api/lists/:id", () => {
  test("PATCH updates only the given fields", async () => {
    const { list } = await createList({ name: "Old name", description: "Kept" });
    const res = await api(`/api/lists/${list.id}`, json("PATCH", { name: "New name" }));
    assert.equal(res.status, 200);
    const updated = (await res.json()) as List;
    assert.equal(updated.name, "New name");
    assert.equal(updated.description, "Kept");
  });

  test("PATCH with an empty body is a 422", async () => {
    const { list } = await createList();
    assert.equal((await api(`/api/lists/${list.id}`, json("PATCH", {}))).status, 422);
  });

  test("DELETE answers 204, then the list is gone", async () => {
    const { list } = await createList();
    const res = await api(`/api/lists/${list.id}`, as(alice, { method: "DELETE" }));
    assert.equal(res.status, 204);
    assert.equal(await res.text(), "");
    assert.equal((await api(`/api/lists/${list.id}`)).status, 404);
    assert.equal((await api(`/api/lists/${list.id}`, as(alice, { method: "DELETE" }))).status, 404);
  });

  test("[R6] 401 when signed out", async () => {
    const { list } = await createList();
    assert.equal((await api("/api/lists", jsonAs("POST", { name: "Anonymous" }))).status, 401);
    assert.equal((await api(`/api/lists/${list.id}`, jsonAs("PATCH", { name: "Anonymous" }))).status, 401);
    assert.equal((await api(`/api/lists/${list.id}`, { method: "DELETE" })).status, 401);
  });

  test("[R6] another user's list is 403", async () => {
    assert.equal((await api(`/api/lists/${BOB_LIST}`, json("PATCH", { name: "Mine now" }))).status, 403);
    assert.equal((await api(`/api/lists/${BOB_LIST}`, as(alice, { method: "DELETE" }))).status, 403);
  });
});

describe("[M2] list items", () => {
  test("POST adds an item with the media's title: 201, then 409 on a duplicate", async () => {
    const { list } = await createList();
    const res = await api(`/api/lists/${list.id}/items`, json("POST", { mediaId: "Q190192", note: "The book, not the film" }));
    assert.equal(res.status, 201);
    assert.equal(res.headers.get("location"), `/api/lists/${list.id}/items/Q190192`);
    const item = (await res.json()) as ListItem;
    assert.deepEqual({ ...item, addedAt: undefined }, {
      mediaId: "Q190192",
      type: "book",
      title: "Dune",
      year: 1965,
      // Copied from the media, like the title (the extended reference pattern).
      image: { url: item.image!.url, kind: "logo", sourceUrl: item.image!.sourceUrl, license: item.image!.license, author: item.image!.author },
      note: "The book, not the film",
      addedAt: undefined,
    });
    assert.equal((await api(res.headers.get("location")!)).status, 200);

    const again = await api(`/api/lists/${list.id}/items`, json("POST", { mediaId: "Q190192" }));
    assert.equal(again.status, 409);
  });

  test("POST with an unknown media is a 422", async () => {
    const { list } = await createList();
    const res = await api(`/api/lists/${list.id}/items`, json("POST", { mediaId: "Q0" }));
    assert.equal(res.status, 422);
    assert.equal(((await res.json()) as ProblemDetails).errors?.[0]?.pointer, "#/mediaId");
  });

  test("PUT replaces and reorders the items, and is idempotent", async () => {
    const { list } = await createList();
    await api(`/api/lists/${list.id}/items`, json("POST", { mediaId: "Q25188" }));
    const body = [{ mediaId: "Q83495" }, { mediaId: "Q25188", note: "Rewatch" }];
    const first = (await (await api(`/api/lists/${list.id}/items`, json("PUT", body))).json()) as List;
    const second = (await (await api(`/api/lists/${list.id}/items`, json("PUT", body))).json()) as List;
    assert.deepEqual(first.items.map((i) => i.title), ["The Matrix", "Inception"]);
    assert.deepEqual(second.items, first.items);
  });

  test("PUT rejects duplicates and unknown media", async () => {
    const { list } = await createList();
    const duplicate = await api(`/api/lists/${list.id}/items`, json("PUT", [{ mediaId: "Q25188" }, { mediaId: "Q25188" }]));
    assert.equal(duplicate.status, 422);
    const unknown = await api(`/api/lists/${list.id}/items`, json("PUT", [{ mediaId: "Q25188" }, { mediaId: "Q0" }]));
    assert.equal(((await unknown.json()) as ProblemDetails).errors?.[0]?.pointer, "#/1/mediaId");
  });

  test("DELETE removes an item: 204, then 404", async () => {
    const { list } = await createList();
    await api(`/api/lists/${list.id}/items`, json("POST", { mediaId: "Q25188" }));
    assert.equal((await api(`/api/lists/${list.id}/items/Q25188`, as(alice, { method: "DELETE" }))).status, 204);
    assert.equal((await api(`/api/lists/${list.id}/items/Q25188`, as(alice, { method: "DELETE" }))).status, 404);
  });
});

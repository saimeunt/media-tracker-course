import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { CursorPage, Genre, Media, ProblemDetails } from "@media-tracker/shared";
import { startApi } from "./helpers.ts";

const api = startApi();

async function page(query: string) {
  const res = await api(`/api/media?${query}`);
  assert.equal(res.status, 200);
  return (await res.json()) as CursorPage<Media>;
}

describe("[R4] GET /api/media", () => {
  test("returns the 20 most popular items by default", async () => {
    const { items, nextCursor } = await page("");
    assert.equal(items.length, 20);
    assert.ok(nextCursor);
    const popularity = items.map((m) => m.popularity);
    assert.deepEqual(popularity, popularity.toSorted((a, b) => b - a));
  });

  test("[M7] filters by type and by normalized genre, ignoring case", async () => {
    const { items } = await page("type=book&genre=Science%20Fiction&limit=100");
    assert.ok(items.length > 0);
    for (const m of items) {
      assert.equal(m.type, "book");
      assert.ok(m.tags.includes("science fiction"));
    }
    // "science fiction novel" and "science fiction film" are both tagged "science fiction".
    const movies = await page("type=movie&genre=science%20fiction&limit=100");
    assert.ok(movies.items.some((m) => m.genres.includes("science fiction film")));
  });

  test("sorts by average rating, only rated media, with stats", async () => {
    const { items, nextCursor } = await page("sort=-rating&limit=2");
    assert.deepEqual(
      items.map((m) => [m.title, m.stats.averageRating]),
      [["Breaking Bad", 10], ["Memento", 8]],
    );
    const next = await page(`sort=-rating&limit=2&cursor=${nextCursor}`);
    assert.deepEqual(next.items.map((m) => [m.title, m.stats]), [
      ["Inception", { entryCount: 2, ratingCount: 2, averageRating: 7.5 }],
      ["Black Mirror", { entryCount: 1, ratingCount: 1, averageRating: 5 }],
    ]);
    assert.equal(next.nextCursor, null);
    const popular = await page("sort=-rating&minRatings=2");
    assert.deepEqual(popular.items.map((m) => m.title), ["Inception"]);
  });

  test("sorts by title", async () => {
    const { items } = await page("type=game&sort=title&limit=50");
    const titles = items.map((m) => m.title);
    assert.deepEqual(titles, titles.toSorted());
  });

  test("walks every page with the cursor, without gaps or duplicates", async () => {
    for (const sort of ["-popularity", "title"]) {
      const seen: string[] = [];
      let cursor: string | null = "";
      while (cursor !== null) {
        const result: CursorPage<Media> = await page(`type=series&sort=${sort}&limit=7${cursor && `&cursor=${cursor}`}`);
        seen.push(...result.items.map((m) => m.id));
        cursor = result.nextCursor;
      }
      assert.equal(seen.length, 150);
      assert.equal(new Set(seen).size, 150);
    }
  });

  test("rejects invalid parameters with a 400 problem", async () => {
    const res = await api("/api/media?type=podcast&limit=500");
    assert.equal(res.status, 400);
    const problem = (await res.json()) as ProblemDetails;
    assert.deepEqual(problem.errors?.map((e) => e.parameter), ["type", "limit"]);
  });

  test("rejects a cursor made for another sort", async () => {
    const { nextCursor } = await page("sort=title");
    const res = await api(`/api/media?sort=-popularity&cursor=${nextCursor}`);
    assert.equal(res.status, 400);
  });
});

test("[M7] GET /api/genres lists normalized genres, most common first", async () => {
  const res = await api("/api/genres?type=movie");
  assert.equal(res.status, 200);
  const genres = (await res.json()) as Genre[];
  assert.equal(genres[0]!.name, "drama");
  assert.ok(genres.every((g, i) => i === 0 || genres[i - 1]!.count >= g.count));
  assert.ok(!genres.some((g) => g.name.endsWith(" film")));
});

describe("GET /api/media/:id", () => {
  test("returns the item with its type-specific fields", async () => {
    const res = await api("/api/media/Q25188");
    assert.equal(res.status, 200);
    const media = (await res.json()) as Media;
    assert.equal(media.title, "Inception");
    assert.equal(media.type === "movie" && media.directors[0], "Christopher Nolan");
    // A file from Wikimedia Commons, with what crediting it takes.
    assert.equal(media.image?.kind, "logo");
    assert.match(media.image.url, /^https:\/\/[a-z.]+\.wikimedia\.org\//);
    assert.match(media.image.sourceUrl, /^https:\/\/commons\.wikimedia\.org\/wiki\/File:/);
  });

  test("returns 404 for an unknown id", async () => {
    const res = await api("/api/media/Q0");
    assert.equal(res.status, 404);
  });

  test("[R5] answers 304 when the client's ETag is current", async () => {
    const first = await api("/api/media/Q25188");
    const etag = first.headers.get("etag");
    assert.ok(etag);
    assert.equal(first.headers.get("cache-control"), "public, no-cache");

    const second = await api("/api/media/Q25188", { headers: { "If-None-Match": etag } });
    assert.equal(second.status, 304);
    assert.equal(await second.text(), "");

    const weak = await api("/api/media/Q25188", { headers: { "If-None-Match": `"other", W/${etag}` } });
    assert.equal(weak.status, 304);

    const stale = await api("/api/media/Q25188", { headers: { "If-None-Match": '"outdated"' } });
    assert.equal(stale.status, 200);
  });
});

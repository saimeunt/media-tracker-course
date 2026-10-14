import { Router } from "express";
import { MEDIA_TYPES, mediaQuerySchema } from "@media-tracker/shared";
import type { CursorPage, Genre, Media, MediaSort } from "@media-tracker/shared";
import { z } from "zod";
import { sendCacheable } from "../http/etag.ts";
import { HttpError, todo } from "../http/problem.ts";
import { parseQuery } from "../http/validation.ts";
import type { MediaPage, Store } from "../store/types.ts";

type Cursor = { sort: MediaSort; value: string | number; id: string };

// Cursors are opaque to clients: base64url-encoded JSON they pass back unchanged.
function encodeCursor(cursor: Cursor) {
  return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}

function decodeCursor(raw: string, sort: MediaSort): MediaPage["next"] {
  // TODO R4: decode the cursor, 400 when it's invalid or made for another sort
  todo("R4");
}

export function mediaRouter(store: Store) {
  const router = Router();

  router.get("/media", async (req, res) => {
    // TODO R4: start after the cursor when there is one, and answer the next page's cursor (null on the last page)
    const { cursor: _, ...query } = parseQuery(req, mediaQuerySchema);
    const { items } = await store.media.find(query, null);
    const body: CursorPage<Media> = { items, nextCursor: null };
    res.json(body);
  });

  router.get("/genres", async (req, res) => {
    const { type } = parseQuery(req, z.object({ type: z.enum(MEDIA_TYPES).optional() }));
    const body: Genre[] = await store.media.genres(type);
    res.json(body);
  });

  router.get("/media/:id", async (req, res) => {
    const media = await store.media.findById(req.params.id);
    if (!media) throw new HttpError(404, `No media with id ${req.params.id}`);
    // Caches may store the response but must check it is still current (ETag) before reusing it.
    res.set("Cache-Control", "public, no-cache");
    sendCacheable(req, res, media);
  });

  return router;
}

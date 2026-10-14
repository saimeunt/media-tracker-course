import { Router } from "express";
import { entriesQuerySchema, entryPutSchema } from "@media-tracker/shared";
import type { Entry, OffsetPage, UserStats } from "@media-tracker/shared";
import { requireOwner, requireUser } from "../http/auth.ts";
import { HttpError } from "../http/problem.ts";
import { parseBody, parseQuery } from "../http/validation.ts";
import type { EntryRecord, Store } from "../store/types.ts";

function toEntry(entry: EntryRecord): Entry {
  return { ...entry, createdAt: entry.createdAt.toISOString(), updatedAt: entry.updatedAt.toISOString() };
}

/** A user's library: what they watched, read or played. Libraries are public, only their owner edits them. */
export function entriesRouter(store: Store) {
  const router = Router();

  async function findUser(id: string) {
    const user = await store.users.findById(id);
    if (!user) throw new HttpError(404, `No user with id ${id}`);
    return user;
  }

  router.get("/users/:id/entries", async (req, res) => {
    const user = await findUser(req.params.id);
    const { status, type, page, limit } = parseQuery(req, entriesQuerySchema);
    const { entries, total } = await store.entries.find({ userId: user.id, status, type, skip: (page - 1) * limit, limit });
    const body: OffsetPage<Entry> = { items: entries.map(toEntry), page, limit, total };
    res.json(body);
  });

  router.get("/users/:id/entries/:mediaId", async (req, res) => {
    const entry = await store.entries.findOne(req.params.id, req.params.mediaId);
    if (!entry) throw new HttpError(404, `Media ${req.params.mediaId} is not in this library`);
    res.json(toEntry(entry));
  });

  // PUT creates the entry or replaces it: 201 the first time, 200 after.
  router.put("/users/:id/entries/:mediaId", async (req, res) => {
    const userId = requireUser(req.user);
    requireOwner(userId, (await findUser(req.params.id)).id);
    const input = parseBody(req, entryPutSchema);
    const media = await store.media.findById(req.params.mediaId);
    if (!media) throw new HttpError(404, `No media with id ${req.params.mediaId}`);
    const { entry, created } = await store.entries.upsert({
      userId,
      mediaId: media.id,
      type: media.type,
      title: media.title,
      year: media.year,
      ...input,
    });
    if (created) res.status(201).location(`/api/users/${userId}/entries/${media.id}`);
    res.json(toEntry(entry));
  });

  router.delete("/users/:id/entries/:mediaId", async (req, res) => {
    const userId = requireUser(req.user);
    requireOwner(userId, (await findUser(req.params.id)).id);
    if (!(await store.entries.delete(userId, req.params.mediaId))) {
      throw new HttpError(404, `Media ${req.params.mediaId} is not in this library`);
    }
    res.status(204).end();
  });

  router.get("/users/:id/stats", async (req, res) => {
    const user = await findUser(req.params.id);
    const body: UserStats = await store.entries.userStats(user.id);
    res.json(body);
  });

  return router;
}

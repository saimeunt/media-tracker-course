import { Router } from "express";
import type { Request } from "express";
import { listCreateSchema, listItemCreateSchema, listItemsReplaceSchema, listsQuerySchema, listUpdateSchema } from "@media-tracker/shared";
import type { List, ListItem, ListSummary, OffsetPage } from "@media-tracker/shared";
import { requireOwner, requireUser } from "../http/auth.ts";
import { HttpError, todo } from "../http/problem.ts";
import { parseBody, parseQuery } from "../http/validation.ts";
import type { ListItemRecord, ListRecord, Store } from "../store/types.ts";

// Mappers from stored records to the JSON the API returns: the storage shape never leaks.
function toListItem(item: ListItemRecord): ListItem {
  return { ...item, addedAt: item.addedAt.toISOString() };
}

function toList(list: ListRecord): List {
  return {
    ...list,
    items: list.items.map(toListItem),
    createdAt: list.createdAt.toISOString(),
    updatedAt: list.updatedAt.toISOString(),
  };
}

function toListSummary(list: ListRecord): ListSummary {
  const { items, ...rest } = toList(list);
  return { ...rest, itemCount: items.length };
}

export function listsRouter(store: Store) {
  const router = Router();

  /** The list, if the current user may see it: private lists are 404 for everyone but their owner. */
  async function findVisibleList(req: Request<{ id: string }>) {
    const list = await store.lists.findById(req.params.id);
    if (!list || (list.visibility === "private" && list.ownerId !== req.user?.id)) {
      throw new HttpError(404, `No list with id ${req.params.id}`);
    }
    return list;
  }

  /** The list, if the current user owns it: 401 when signed out, 404 when hidden, 403 when not the owner. */
  async function findOwnedList(req: Request<{ id: string }>) {
    // TODO R6: 401 when signed out, 403 when not the owner (see requireUser and requireOwner in http/auth.ts)
    return findVisibleList(req);
  }

  /** Builds list items from client input, copying the media fields lists display. 422 for unknown media. */
  async function toItemRecords(input: { mediaId: string; note?: string | undefined }[], pointerPrefix: string) {
    const records: ListItemRecord[] = [];
    for (const [index, { mediaId, note }] of input.entries()) {
      const media = await store.media.findById(mediaId);
      if (!media) {
        const pointer = pointerPrefix.replace("{index}", String(index));
        throw new HttpError(422, "The request body is invalid", {
          errors: [{ pointer, detail: `No media with id ${mediaId}` }],
        });
      }
      const { type, title, year, image } = media;
      records.push({ mediaId, type, title, year, image, note: note ?? null, addedAt: new Date() });
    }
    return records;
  }

  router.get("/lists", async (req, res) => {
    const { ownerId, page, limit } = parseQuery(req, listsQuerySchema);
    const { lists, total } = await store.lists.find({
      ownerId,
      viewerId: req.user?.id ?? null,
      skip: (page - 1) * limit,
      limit,
    });
    const body: OffsetPage<ListSummary> = { items: lists.map(toListSummary), page, limit, total };
    res.json(body);
  });

  router.post("/lists", async (req, res) => {
    const ownerId = requireUser(req.user);
    const input = parseBody(req, listCreateSchema);
    const list = await store.lists.create({ ownerId, ...input });
    res.status(201).location(`/api/lists/${list.id}`).json(toList(list));
  });

  router.get("/lists/:id", async (req, res) => {
    res.json(toList(await findVisibleList(req)));
  });

  router.patch("/lists/:id", async (req, res) => {
    // TODO R2: update the list's fields with the body (listUpdateSchema), answer the updated list
    todo("R2");
  });

  router.delete("/lists/:id", async (req, res) => {
    // TODO R2: delete the list, answer 204 No Content
    todo("R2");
  });

  router.get("/lists/:id/items/:mediaId", async (req, res) => {
    const list = await findVisibleList(req);
    const item = list.items.find((i) => i.mediaId === req.params.mediaId);
    if (!item) throw new HttpError(404, `Media ${req.params.mediaId} is not in this list`);
    res.json(toListItem(item));
  });

  router.post("/lists/:id/items", async (req, res) => {
    const list = await findOwnedList(req);
    const input = parseBody(req, listItemCreateSchema);
    const [item] = await toItemRecords([input], "#/mediaId");
    if (!(await store.lists.addItem(list.id, item!))) {
      throw new HttpError(409, `Media ${input.mediaId} is already in this list`);
    }
    res
      .status(201)
      .location(`/api/lists/${list.id}/items/${input.mediaId}`)
      .json(toListItem(item!));
  });

  // Replaces all items at once, e.g. to reorder them. PUT is idempotent: sending the same request twice leaves the list in the same state.
  router.put("/lists/:id/items", async (req, res) => {
    const list = await findOwnedList(req);
    const input = parseBody(req, listItemsReplaceSchema);
    const items = await toItemRecords(input, "#/{index}/mediaId");
    // Items already in the list keep the date they were first added.
    const addedAt = new Map(list.items.map((i) => [i.mediaId, i.addedAt]));
    for (const item of items) item.addedAt = addedAt.get(item.mediaId) ?? item.addedAt;
    const updated = await store.lists.replaceItems(list.id, items);
    if (!updated) throw new HttpError(404, `No list with id ${list.id}`);
    res.json(toList(updated));
  });

  router.delete("/lists/:id/items/:mediaId", async (req, res) => {
    const list = await findOwnedList(req);
    if (!(await store.lists.removeItem(list.id, req.params.mediaId))) {
      throw new HttpError(404, `Media ${req.params.mediaId} is not in this list`);
    }
    res.status(204).end();
  });

  return router;
}

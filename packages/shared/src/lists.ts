import { z } from "zod";
import type { MediaImage, MediaType } from "@media-tracker/seed-data/types";

export const LIST_VISIBILITIES = ["public", "private"] as const;
export type ListVisibility = (typeof LIST_VISIBILITIES)[number];

/** An item of a list, with a copy of the media fields that list pages display. */
export interface ListItem {
  mediaId: string;
  type: MediaType;
  title: string;
  year: number | null;
  image: MediaImage | null;
  note: string | null;
  addedAt: string;
}

export interface List {
  id: string;
  ownerId: string;
  name: string;
  description: string;
  visibility: ListVisibility;
  items: ListItem[];
  createdAt: string;
  updatedAt: string;
}

/** A list in a collection response: items are left out, only counted. */
export type ListSummary = Omit<List, "items"> & { itemCount: number };

// Strict objects reject unknown fields, so a client can't set ownerId or createdAt itself.

/** Body of POST /api/lists. */
export const listCreateSchema = z.strictObject({
  name: z.string().trim().min(1, "Give the list a name").max(100),
  description: z.string().trim().max(1000).default(""),
  visibility: z.enum(LIST_VISIBILITIES).default("public"),
});
export type ListCreate = z.infer<typeof listCreateSchema>;

/** Body of PATCH /api/lists/:id: any subset of the fields, at least one. */
export const listUpdateSchema = z
  .strictObject({
    name: z.string().trim().min(1, "Give the list a name").max(100),
    description: z.string().trim().max(1000),
    visibility: z.enum(LIST_VISIBILITIES),
  })
  .partial()
  .refine((patch) => Object.keys(patch).length > 0, "Provide at least one field to update");
export type ListUpdate = z.infer<typeof listUpdateSchema>;

/** Body of POST /api/lists/:id/items. */
export const listItemCreateSchema = z.strictObject({
  mediaId: z.string().min(1),
  note: z.string().trim().max(500).optional(),
});
export type ListItemCreate = z.infer<typeof listItemCreateSchema>;

/** Body of PUT /api/lists/:id/items: the whole item list, in order. */
export const listItemsReplaceSchema = z
  .array(listItemCreateSchema)
  .max(500)
  .refine((items) => new Set(items.map((item) => item.mediaId)).size === items.length, "Each media can only appear once");
export type ListItemsReplace = z.infer<typeof listItemsReplaceSchema>;

/** Query parameters of GET /api/lists. */
export const listsQuerySchema = z.object({
  ownerId: z.string().min(1).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type ListsQuery = z.infer<typeof listsQuerySchema>;

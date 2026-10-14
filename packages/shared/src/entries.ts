import { z } from "zod";
import { MEDIA_TYPES } from "@media-tracker/seed-data/types";
import type { MediaType } from "@media-tracker/seed-data/types";

export const ENTRY_STATUSES = ["planned", "in_progress", "completed", "dropped"] as const;
export type EntryStatus = (typeof ENTRY_STATUSES)[number];

/** A media item in a user's library: what they think of it and where they are with it. */
export interface Entry {
  userId: string;
  mediaId: string;
  // Copied from the media, so a library displays without a lookup.
  type: MediaType;
  title: string;
  year: number | null;
  status: EntryStatus;
  /** Out of 10. */
  rating: number | null;
  review: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Body of PUT /api/users/:id/entries/:mediaId: the whole entry (PUT replaces). */
export const entryPutSchema = z.strictObject({
  status: z.enum(ENTRY_STATUSES),
  rating: z.number().int().min(1).max(10).nullable().default(null),
  review: z.string().trim().max(2000).nullable().default(null).transform((review) => review || null),
});
export type EntryPut = z.infer<typeof entryPutSchema>;

/** Query parameters of GET /api/users/:id/entries. */
export const entriesQuerySchema = z.object({
  status: z.enum(ENTRY_STATUSES).optional(),
  type: z.enum(MEDIA_TYPES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type EntriesQuery = z.infer<typeof entriesQuerySchema>;

/** GET /api/users/:id/stats: a user's library, summarized. */
export interface UserStats {
  entryCount: number;
  ratingCount: number;
  averageRating: number | null;
  byType: { type: MediaType; entryCount: number; completedCount: number; averageRating: number | null }[];
  byStatus: Record<EntryStatus, number>;
}

import { z } from "zod";
import { IMAGE_KINDS, MEDIA_TYPES } from "@media-tracker/seed-data/types";
import type { Media as SeedMedia } from "@media-tracker/seed-data/types";

export { IMAGE_KINDS, MEDIA_TYPES };
export type { MediaImage, MediaType } from "@media-tracker/seed-data/types";

/** Omit that keeps a union a union (the built-in Omit merges its members). */
export type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

/** Computed from users' entries, kept up to date when entries change. */
export interface MediaStats {
  /** Number of users with this media in their library. */
  entryCount: number;
  ratingCount: number;
  /** Average rating out of 10, rounded to 2 decimals; null without ratings. */
  averageRating: number | null;
}

/**
 * A media item as the API returns it: `id` is the Wikidata id, `genres` are the raw
 * Wikidata genres, `tags` the same genres normalized (see GET /api/genres).
 */
export type Media = DistributiveOmit<SeedMedia, "wikidataId"> & { id: string; tags: string[]; stats: MediaStats };

/** `-` in front of a field means descending. `-rating` only lists media with ratings. */
export const MEDIA_SORTS = ["-popularity", "popularity", "title", "-title", "-rating"] as const;
export type MediaSort = (typeof MEDIA_SORTS)[number];

/** Query parameters of GET /api/media. */
export const mediaQuerySchema = z.object({
  type: z.enum(MEDIA_TYPES).optional(),
  /** A normalized genre (a tag), e.g. "science fiction". */
  genre: z.string().trim().toLowerCase().min(1).optional(),
  /** Only media rated by at least this many users. */
  minRatings: z.coerce.number().int().min(1).optional(),
  sort: z.enum(MEDIA_SORTS).default("-popularity"),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().min(1).optional(),
});
export type MediaQuery = z.infer<typeof mediaQuerySchema>;

/** A normalized genre and how many media have it. */
export interface Genre {
  name: string;
  count: number;
}

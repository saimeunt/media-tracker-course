import { ENTRY_STATUSES, MEDIA_TYPES } from "@media-tracker/shared";
import type { MediaStats, UserStats } from "@media-tracker/shared";

/** Running totals from which the stats are derived. Both stores keep these. */
export interface StatsTotals {
  entryCount: number;
  ratingCount: number;
  ratingSum: number;
}

/** Average out of 10, rounded to 2 decimals, or null without ratings. */
export function average(sum: number, count: number) {
  return count > 0 ? Math.round((sum / count) * 100) / 100 : null;
}

export function toMediaStats({ entryCount, ratingCount, ratingSum }: StatsTotals): MediaStats {
  return { entryCount, ratingCount, averageRating: average(ratingSum, ratingCount) };
}

/** Stats with no entries, e.g. for a user with an empty library. */
export function emptyUserStats(): UserStats {
  return {
    entryCount: 0,
    ratingCount: 0,
    averageRating: null,
    byType: MEDIA_TYPES.map((type) => ({ type, entryCount: 0, completedCount: 0, averageRating: null })),
    byStatus: Object.fromEntries(ENTRY_STATUSES.map((status) => [status, 0])) as UserStats["byStatus"],
  };
}

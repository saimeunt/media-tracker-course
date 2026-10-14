/**
 * In-memory store: plain arrays, loaded from the seed snapshot and the fixtures.
 * Data is lost on restart. Module 2 replaces it with MongoDB behind the same interfaces.
 */
import { randomBytes } from "node:crypto";
import { media as seedMedia } from "@media-tracker/seed-data";
import type { DistributiveOmit, Media } from "@media-tracker/shared";
import { genreTags } from "../../genres.ts";
import { average, emptyUserStats, toMediaStats } from "../stats.ts";
import type { StatsTotals } from "../stats.ts";
import { DuplicateKeyError } from "../types.ts";
import type {
  EntryCursor,
  EntryRecord,
  EntryRepository,
  FollowRepository,
  ListRecord,
  ListRepository,
  MediaPage,
  MediaRepository,
  Store,
  User,
  UserRepository,
} from "../types.ts";
import * as fixtures from "./fixtures.ts";

type MediaRecord = DistributiveOmit<Media, "stats">;

/** A new id in the same format as a MongoDB ObjectId. */
function newId() {
  return randomBytes(12).toString("hex");
}

/**
 * Orders by the sort field, then by id so that ties have a stable order, which cursor
 * pagination needs. Strings compare by code point, like MongoDB without a collation.
 */
function compare(a: [string | number, string], b: [string | number, string]) {
  if (a[0] !== b[0]) return a[0] < b[0] ? -1 : 1;
  return a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0;
}

/** Media stats, computed from the entries each time they're read. */
function computeStats(entries: EntryRecord[]) {
  const totals = new Map<string, StatsTotals>();
  for (const entry of entries) {
    const total = totals.get(entry.mediaId) ?? { entryCount: 0, ratingCount: 0, ratingSum: 0 };
    total.entryCount++;
    if (entry.rating !== null) {
      total.ratingCount++;
      total.ratingSum += entry.rating;
    }
    totals.set(entry.mediaId, total);
  }
  return (mediaId: string) => toMediaStats(totals.get(mediaId) ?? { entryCount: 0, ratingCount: 0, ratingSum: 0 });
}

function createMediaRepository(media: MediaRecord[], entries: EntryRecord[]): MediaRepository {
  return {
    async find({ type, genre, minRatings, sort, limit }, after) {
      const statsOf = computeStats(entries);
      const withStats: Media[] = media.map((m) => ({ ...m, stats: statsOf(m.id) }));
      // Sorting by rating only makes sense for rated media.
      const minimum = minRatings ?? (sort === "-rating" ? 1 : 0);
      const sortValue = (m: Media): string | number =>
        sort === "-rating" ? m.stats.averageRating! : sort.endsWith("popularity") ? m.popularity : m.title;
      const direction = sort.startsWith("-") ? -1 : 1;
      const key = (m: Media): [string | number, string] => [sortValue(m), m.id];
      const matches = withStats
        // TODO R4: keep the media of the requested type only
        .filter((m) => !genre || m.tags.includes(genre))
        .filter((m) => m.stats.ratingCount >= minimum)
        // TODO R4: keep only the media after the cursor's position (`after`), in sort order
        .sort((a, b) => direction * compare(key(a), key(b)));
      const items = matches.slice(0, limit);
      const last = items.at(-1);
      const next: MediaPage["next"] = matches.length > limit && last ? { value: sortValue(last), id: last.id } : null;
      return { items: structuredClone(items), next };
    },
    async findById(id) {
      const found = media.find((m) => m.id === id);
      return found ? { ...structuredClone(found), stats: computeStats(entries)(id) } : null;
    },
    async findByIds(ids) {
      const statsOf = computeStats(entries);
      return media.filter((m) => ids.includes(m.id)).map((m) => ({ ...structuredClone(m), stats: statsOf(m.id) }));
    },
    async search(text, { type, limit }) {
      // A simple stand-in for MongoDB's text index: any word of the query, in the title
      // (worth more) or the description, case-insensitive. No stemming.
      const words = text.toLowerCase().split(/\W+/).filter((word) => word.length > 1);
      const statsOf = computeStats(entries);
      return media
        .filter((m) => !type || m.type === type)
        .map((m) => {
          const title = m.title.toLowerCase();
          const description = m.description?.toLowerCase() ?? "";
          const score = words.reduce((sum, word) => sum + (title.includes(word) ? 10 : 0) + (description.includes(word) ? 1 : 0), 0);
          return { m, score };
        })
        .filter(({ score }) => score > 0)
        .sort((a, b) => b.score - a.score || b.m.popularity - a.m.popularity)
        .slice(0, limit)
        .map(({ m }) => ({ ...structuredClone(m), stats: statsOf(m.id) }));
    },
    async genres(type) {
      const counts = new Map<string, number>();
      for (const m of media) {
        if (type && m.type !== type) continue;
        for (const tag of m.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
      return [...counts]
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count || compare([a.name, ""], [b.name, ""]));
    },
  };
}

function createListRepository(lists: ListRecord[]): ListRepository {
  const byId = (id: string) => lists.find((list) => list.id === id);
  return {
    async find({ ownerId, viewerId, skip, limit }) {
      const visible = lists
        .filter((list) => !ownerId || list.ownerId === ownerId)
        .filter((list) => list.visibility === "public" || list.ownerId === viewerId)
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime() || compare([b.id, ""], [a.id, ""]));
      return { lists: structuredClone(visible.slice(skip, skip + limit)), total: visible.length };
    },
    async findById(id) {
      const list = byId(id);
      return list ? structuredClone(list) : null;
    },
    async create(input) {
      const now = new Date();
      const list: ListRecord = { id: newId(), ...input, items: [], createdAt: now, updatedAt: now };
      lists.push(list);
      return structuredClone(list);
    },
    async update(id, patch) {
      const list = byId(id);
      if (!list) return null;
      Object.assign(list, patch, { updatedAt: new Date() });
      return structuredClone(list);
    },
    async delete(id) {
      const index = lists.findIndex((list) => list.id === id);
      if (index === -1) return false;
      lists.splice(index, 1);
      return true;
    },
    async addItem(id, item) {
      const list = byId(id);
      if (!list || list.items.some((i) => i.mediaId === item.mediaId)) return false;
      list.items.push(structuredClone(item));
      list.updatedAt = new Date();
      return true;
    },
    async removeItem(id, mediaId) {
      const list = byId(id);
      const index = list?.items.findIndex((i) => i.mediaId === mediaId) ?? -1;
      if (!list || index === -1) return false;
      list.items.splice(index, 1);
      list.updatedAt = new Date();
      return true;
    },
    async replaceItems(id, items) {
      const list = byId(id);
      if (!list) return null;
      list.items = structuredClone(items);
      list.updatedAt = new Date();
      return structuredClone(list);
    },
  };
}

function createUserRepository(users: User[]): UserRepository {
  return {
    async findById(id) {
      const user = users.find((u) => u.id === id);
      return user ? structuredClone(user) : null;
    },
    async findByIds(ids) {
      return structuredClone(users.filter((u) => ids.includes(u.id)));
    },
    async findByEmail(email) {
      const user = users.find((u) => u.email === email);
      return user ? structuredClone(user) : null;
    },
    async create(input) {
      for (const field of ["username", "email"] as const) {
        if (users.some((u) => u[field] === input[field])) throw new DuplicateKeyError(field);
      }
      const user: User = { id: newId(), ...input, createdAt: new Date() };
      users.push(user);
      return structuredClone(user);
    },
  };
}

/** Compares entries in the order of EntryCursor: (updatedAt, userId, mediaId). */
function compareEntries(a: EntryCursor, b: EntryCursor) {
  return a.updatedAt.getTime() - b.updatedAt.getTime() || compare([a.userId, a.mediaId], [b.userId, b.mediaId]);
}

function createEntryRepository(entries: EntryRecord[]): EntryRepository {
  const indexOf = (userId: string, mediaId: string) =>
    entries.findIndex((e) => e.userId === userId && e.mediaId === mediaId);
  return {
    async page({ userIds, mediaId, status, withReview }, first, after) {
      const matches = entries
        .filter((e) => !userIds || userIds.includes(e.userId))
        .filter((e) => !mediaId || e.mediaId === mediaId)
        .filter((e) => !status || e.status === status)
        .filter((e) => !withReview || e.review !== null)
        .filter((e) => !after || compareEntries(e, after) < 0)
        .sort((a, b) => compareEntries(b, a));
      return { entries: structuredClone(matches.slice(0, first)), hasNextPage: matches.length > first };
    },
    async find({ userId, status, type, skip, limit }) {
      const matches = entries
        .filter((e) => e.userId === userId && (!status || e.status === status) && (!type || e.type === type))
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime() || compare([b.mediaId, ""], [a.mediaId, ""]));
      return { entries: structuredClone(matches.slice(skip, skip + limit)), total: matches.length };
    },
    async findOne(userId, mediaId) {
      const entry = entries[indexOf(userId, mediaId)];
      return entry ? structuredClone(entry) : null;
    },
    async upsert(input) {
      const now = new Date();
      const index = indexOf(input.userId, input.mediaId);
      const existing = entries[index];
      const entry: EntryRecord = { ...input, createdAt: existing?.createdAt ?? now, updatedAt: now };
      if (existing) entries[index] = entry;
      else entries.push(entry);
      return { entry: structuredClone(entry), created: !existing };
    },
    async delete(userId, mediaId) {
      const index = indexOf(userId, mediaId);
      if (index === -1) return false;
      entries.splice(index, 1);
      return true;
    },
    async userStats(userId) {
      const stats = emptyUserStats();
      let ratingSum = 0;
      const byType = new Map(stats.byType.map((t) => [t.type, { ...t, ratingSum: 0, ratingCount: 0 }]));
      for (const entry of entries.filter((e) => e.userId === userId)) {
        const forType = byType.get(entry.type)!;
        stats.entryCount++;
        stats.byStatus[entry.status]++;
        forType.entryCount++;
        if (entry.status === "completed") forType.completedCount++;
        if (entry.rating !== null) {
          stats.ratingCount++;
          ratingSum += entry.rating;
          forType.ratingCount++;
          forType.ratingSum += entry.rating;
        }
      }
      stats.averageRating = average(ratingSum, stats.ratingCount);
      stats.byType = [...byType.values()].map(({ ratingSum, ratingCount, ...t }) => ({
        ...t,
        averageRating: average(ratingSum, ratingCount),
      }));
      return stats;
    },
  };
}

function createFollowRepository(follows: typeof fixtures.follows): FollowRepository {
  const has = (followerId: string, followeeId: string) =>
    follows.some((f) => f.followerId === followerId && f.followeeId === followeeId);
  return {
    async follow(followerId, followeeId) {
      if (!has(followerId, followeeId)) follows.push({ followerId, followeeId, createdAt: new Date() });
    },
    async unfollow(followerId, followeeId) {
      const index = follows.findIndex((f) => f.followerId === followerId && f.followeeId === followeeId);
      if (index !== -1) follows.splice(index, 1);
    },
    async isFollowing(followerId, followeeId) {
      return has(followerId, followeeId);
    },
    async followingIds(followerId) {
      return follows.filter((f) => f.followerId === followerId).map((f) => f.followeeId);
    },
    async counts(userId) {
      return {
        followers: follows.filter((f) => f.followeeId === userId).length,
        following: follows.filter((f) => f.followerId === userId).length,
      };
    },
  };
}

export function createMemoryStore(): Store {
  // Copies, so each store (one per test file) starts from the same data.
  const media: MediaRecord[] = seedMedia.map(({ wikidataId, ...rest }) => ({
    id: wikidataId,
    ...rest,
    tags: genreTags(rest.genres),
  }));
  const entries = structuredClone(fixtures.entries);
  return {
    media: createMediaRepository(media, entries),
    lists: createListRepository(structuredClone(fixtures.lists)),
    users: createUserRepository(structuredClone(fixtures.users)),
    entries: createEntryRepository(entries),
    follows: createFollowRepository(structuredClone(fixtures.follows)),
    async ping() {},
    async close() {},
  };
}

/**
 * Synthetic users, library entries and lists, generated with Faker from a fixed seed: the
 * same seed always gives the same data, on every machine. The media are the real catalog.
 *
 * The volume (a few hundred users, tens of thousands of entries) is enough for indexes and
 * aggregations to make a visible difference.
 */
import { Faker, en } from "@faker-js/faker";
import type { Media, MediaImage, MediaType } from "./types.ts";

export const ENTRY_STATUSES = ["planned", "in_progress", "completed", "dropped"] as const;

export interface SyntheticUser {
  id: string;
  username: string;
  email: string;
  createdAt: Date;
}

export interface SyntheticEntry {
  userId: string;
  mediaId: string;
  type: MediaType;
  title: string;
  year: number | null;
  status: (typeof ENTRY_STATUSES)[number];
  rating: number | null;
  review: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SyntheticList {
  id: string;
  ownerId: string;
  name: string;
  description: string;
  visibility: "public" | "private";
  items: { mediaId: string; type: MediaType; title: string; year: number | null; image: MediaImage | null; note: string | null; addedAt: Date }[];
  createdAt: Date;
  updatedAt: Date;
}

export interface SyntheticFollow {
  followerId: string;
  followeeId: string;
  createdAt: Date;
}

export interface SyntheticOptions {
  seed?: number;
  userCount?: number;
  /** Usernames already taken (e.g. by fixtures). */
  reservedUsernames?: string[];
}

const START = new Date("2024-01-01T00:00:00Z");
const END = new Date("2026-10-01T00:00:00Z");

const REVIEWS: Record<"great" | "good" | "mixed" | "bad", string[]> = {
  great: [
    "An absolute classic. Worth every minute.",
    "One of my all-time favourites.",
    "Blew me away. I'll come back to it.",
    "Brilliant from start to finish.",
    "Everything I hoped for, and more.",
  ],
  good: [
    "Really enjoyed it, a few slow parts.",
    "Solid. I'd recommend it.",
    "Better than I expected.",
    "Good, though the ending felt rushed.",
  ],
  mixed: [
    "Some great moments, some boring ones.",
    "I can see why people like it. Not for me.",
    "Fine, but forgettable.",
    "Started strong, lost me halfway.",
  ],
  bad: ["Couldn't get into it.", "Overrated.", "Not my thing at all.", "I wanted to like it."],
};

const TYPE_PLURALS: Record<MediaType, string> = { movie: "movies", book: "books", game: "games", series: "series" };

export function generateSyntheticData(media: Media[], options: SyntheticOptions = {}) {
  const images = new Map(media.map((item) => [item.wikidataId, item.image]));
  const imageOf = (mediaId: string) => images.get(mediaId) ?? null;
  const { seed = 2026, userCount = 400, reservedUsernames = [] } = options;
  const faker = new Faker({ locale: [en] });
  faker.seed(seed);

  const id = () => faker.string.hexadecimal({ length: 24, casing: "lower", prefix: "" });
  const normal = () => {
    // Box-Muller: a normally distributed number from two uniform ones.
    const u = 1 - faker.number.float({ min: 0, max: 1 });
    const v = faker.number.float({ min: 0, max: 1 });
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  const between = (from: Date, to: Date) => faker.date.between({ from, to });

  // Each media has a hidden "quality" that ratings gather around: higher for famous works, with some surprises.
  const maxPopularity = Math.max(...media.map((m) => m.popularity));
  const quality = new Map(
    media.map((m) => [m.wikidataId, 5 + 3 * Math.log(m.popularity) / Math.log(maxPopularity) + faker.number.float({ min: -1.5, max: 1.5 })]),
  );

  // --- Users ---
  const taken = new Set(reservedUsernames);
  const users: SyntheticUser[] = [];
  while (users.length < userCount) {
    const base = faker.internet
      .username()
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "_")
      .slice(0, 16);
    let username = base.length >= 3 ? base : `${base}_fan`;
    while (taken.has(username)) username = `${base}${faker.number.int({ min: 1, max: 999 })}`;
    taken.add(username);
    users.push({ id: id(), username, email: `${username}@example.com`, createdAt: between(START, new Date("2026-06-01T00:00:00Z")) });
  }

  // --- Entries: each user picks media weighted by popularity and by their favourite types ---
  const entries: SyntheticEntry[] = [];
  const lists: SyntheticList[] = [];
  for (const user of users) {
    const typeTaste: Record<MediaType, number> = {
      movie: faker.number.float({ min: 0.2, max: 1 }),
      book: faker.number.float({ min: 0.05, max: 1 }),
      game: faker.number.float({ min: 0.05, max: 1 }),
      series: faker.number.float({ min: 0.1, max: 1 }),
    };
    const harshness = normal() * 0.8;
    // Most users log a few dozen items, a few log hundreds.
    const count = Math.round(8 + 190 * faker.number.float({ min: 0, max: 1 }) ** 3);
    const weighted = media.map((m) => ({ value: m, weight: m.popularity ** 1.5 * typeTaste[m.type] }));
    const picked = new Set<Media>();
    while (picked.size < count) picked.add(faker.helpers.weightedArrayElement(weighted));

    const library: SyntheticEntry[] = [];
    for (const m of picked) {
      const status = faker.helpers.weightedArrayElement([
        { value: "completed" as const, weight: 60 },
        { value: "planned" as const, weight: 20 },
        { value: "in_progress" as const, weight: 12 },
        { value: "dropped" as const, weight: 8 },
      ]);
      let rating: number | null = null;
      if ((status === "completed" && faker.datatype.boolean(0.9)) || (status === "dropped" && faker.datatype.boolean(0.6))) {
        const score = quality.get(m.wikidataId)! + normal() * 1.4 - harshness - (status === "dropped" ? 2.5 : 0);
        rating = Math.min(10, Math.max(1, Math.round(score)));
      }
      let review: string | null = null;
      if (rating !== null && faker.datatype.boolean(0.25)) {
        const band = rating >= 9 ? "great" : rating >= 7 ? "good" : rating >= 5 ? "mixed" : "bad";
        review = faker.helpers.arrayElement(REVIEWS[band]);
      }
      const createdAt = between(user.createdAt, END);
      const updatedAt = faker.datatype.boolean(0.3) ? between(createdAt, END) : createdAt;
      library.push({ userId: user.id, mediaId: m.wikidataId, type: m.type, title: m.title, year: m.year, status, rating, review, createdAt, updatedAt });
    }
    entries.push(...library);

    // --- Lists: about half the users make some, mostly from what they loved ---
    const listCount = faker.helpers.weightedArrayElement([
      { value: 0, weight: 50 },
      { value: 1, weight: 30 },
      { value: 2, weight: 15 },
      { value: 3, weight: 5 },
    ]);
    const favourites = library.filter((e) => (e.rating ?? 0) >= 8);
    for (let i = 0; i < listCount; i++) {
      const pool = favourites.length >= 3 ? favourites : library;
      const chosen = faker.helpers.arrayElements(pool, { min: Math.min(3, pool.length), max: Math.min(15, pool.length) });
      const mainType = faker.helpers.arrayElement(chosen).type;
      const name = faker.helpers.arrayElement([
        `Favourite ${TYPE_PLURALS[mainType]}`,
        `${faker.word.adjective({ length: { min: 4, max: 9 } })} picks`.replace(/^./, (c) => c.toUpperCase()),
        "Comfort picks",
        "Recommended to friends",
        `Best ${TYPE_PLURALS[mainType]} of all time`,
        "Rainy day list",
        "Hidden gems",
      ]);
      const createdAt = between(user.createdAt, END);
      lists.push({
        id: id(),
        ownerId: user.id,
        name,
        description: faker.datatype.boolean(0.5) ? faker.helpers.arrayElement(["A few I keep coming back to.", "In no particular order.", "Ranked, best first.", "Start with the first one."]) : "",
        visibility: faker.datatype.boolean(0.85) ? "public" : "private",
        items: chosen.map((e) => ({ mediaId: e.mediaId, type: e.type, title: e.title, year: e.year, image: imageOf(e.mediaId), note: null, addedAt: createdAt })),
        createdAt,
        updatedAt: between(createdAt, END),
      });
    }
  }

  // --- Follows: most users follow a few dozen others, and some users attract many followers ---
  const follows: SyntheticFollow[] = [];
  const influence = users.map((user) => ({ value: user, weight: faker.number.float({ min: 0, max: 1 }) ** 4 + 0.01 }));
  for (const user of users) {
    const count = Math.round(40 * faker.number.float({ min: 0, max: 1 }) ** 2);
    const followed = new Set<SyntheticUser>();
    for (let i = 0; i < count * 3 && followed.size < count; i++) {
      const candidate = faker.helpers.weightedArrayElement(influence);
      if (candidate !== user) followed.add(candidate);
    }
    for (const followee of followed) {
      const since = followee.createdAt > user.createdAt ? followee.createdAt : user.createdAt;
      follows.push({ followerId: user.id, followeeId: followee.id, createdAt: between(since, END) });
    }
  }

  return { users, entries, lists, follows };
}

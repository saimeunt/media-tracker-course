/**
 * Hand-written users and lists for the in-memory store. Ids look like MongoDB ObjectIds
 * (24 hex characters) so the same fixtures can be loaded into MongoDB later.
 * Both users' password is "password123".
 */
import { media } from "@media-tracker/seed-data";
import type { EntryRecord, ListRecord, User } from "../types.ts";

const createdAt = new Date("2026-09-01T09:00:00Z");

/** A media's image, copied into list items like their title. */
function imageOf(mediaId: string) {
  return media.find((item) => item.wikidataId === mediaId)?.image ?? null;
}

export const users: User[] = [
  {
    id: "66f4a1000000000000000001",
    username: "alice",
    email: "alice@example.com",
    passwordHash: "scrypt$16384$8$1$bboqN7JKfruf91iE5A83Ow$c6GTtgRTHSfEkXzpH1bMVIORsvUb0Um3GadVtfLVNI0",
    createdAt,
  },
  {
    id: "66f4a1000000000000000002",
    username: "bob",
    email: "bob@example.com",
    passwordHash: "scrypt$16384$8$1$XPA5RmmBci1mHDfAX30xmg$2ZBSnEhM8UUxnpsCGukneyiXeRQ-Sdm36PIHQ_8QDUw",
    createdAt,
  },
];

const [alice, bob] = users as [User, User];

export const lists: ListRecord[] = [
  {
    id: "66f4a2000000000000000001",
    ownerId: alice.id,
    name: "Mind-bending sci-fi",
    description: "Films and books that mess with time, memory or reality.",
    visibility: "public",
    items: [
      { mediaId: "Q25188", type: "movie", title: "Inception", year: 2010, image: imageOf("Q25188"), note: null, addedAt: createdAt },
      { mediaId: "Q190525", type: "movie", title: "Memento", year: 2000, image: imageOf("Q190525"), note: "Watch it twice.", addedAt: createdAt },
      { mediaId: "Q20382729", type: "movie", title: "Arrival", year: 2016, image: imageOf("Q20382729"), note: null, addedAt: createdAt },
      { mediaId: "Q662029", type: "book", title: "Neuromancer", year: 1984, image: imageOf("Q662029"), note: null, addedAt: createdAt },
    ],
    createdAt,
    updatedAt: new Date("2026-09-03T18:30:00Z"),
  },
  {
    id: "66f4a2000000000000000002",
    ownerId: alice.id,
    name: "To play this winter",
    description: "",
    visibility: "private",
    items: [
      { mediaId: "Q279446", type: "game", title: "Portal 2", year: 2011, image: imageOf("Q279446"), note: null, addedAt: createdAt },
      { mediaId: "Q17185964", type: "game", title: "The Legend of Zelda: Breath of the Wild", year: 2017, image: imageOf("Q17185964"), note: null, addedAt: createdAt },
    ],
    createdAt,
    updatedAt: new Date("2026-09-02T12:00:00Z"),
  },
  {
    id: "66f4a2000000000000000003",
    ownerId: bob.id,
    name: "Binge-worthy",
    description: "Series I couldn't stop watching.",
    visibility: "public",
    items: [
      { mediaId: "Q1079", type: "series", title: "Breaking Bad", year: 2008, image: imageOf("Q1079"), note: null, addedAt: createdAt },
      { mediaId: "Q558112", type: "series", title: "Black Mirror", year: 2011, image: imageOf("Q558112"), note: "Start with season 3.", addedAt: createdAt },
    ],
    createdAt,
    updatedAt: new Date("2026-09-04T08:15:00Z"),
  },
];

/** Library entries: what alice and bob watched, read or played, and their ratings. */
export const entries: EntryRecord[] = [
  { userId: alice.id, mediaId: "Q25188", type: "movie", title: "Inception", year: 2010, status: "completed", rating: 9, review: "Still thinking about that ending.", createdAt, updatedAt: new Date("2026-09-05T20:00:00Z") },
  { userId: alice.id, mediaId: "Q190525", type: "movie", title: "Memento", year: 2000, status: "completed", rating: 8, review: null, createdAt, updatedAt: new Date("2026-09-04T20:00:00Z") },
  { userId: alice.id, mediaId: "Q662029", type: "book", title: "Neuromancer", year: 1984, status: "in_progress", rating: null, review: null, createdAt, updatedAt: new Date("2026-09-06T08:00:00Z") },
  { userId: alice.id, mediaId: "Q279446", type: "game", title: "Portal 2", year: 2011, status: "planned", rating: null, review: null, createdAt, updatedAt: new Date("2026-09-02T12:00:00Z") },
  { userId: bob.id, mediaId: "Q25188", type: "movie", title: "Inception", year: 2010, status: "completed", rating: 6, review: "Too loud.", createdAt, updatedAt: new Date("2026-09-05T21:00:00Z") },
  { userId: bob.id, mediaId: "Q1079", type: "series", title: "Breaking Bad", year: 2008, status: "completed", rating: 10, review: null, createdAt, updatedAt: new Date("2026-09-03T22:00:00Z") },
  { userId: bob.id, mediaId: "Q558112", type: "series", title: "Black Mirror", year: 2011, status: "dropped", rating: 5, review: null, createdAt, updatedAt: new Date("2026-09-01T22:00:00Z") },
];

/** alice follows bob. */
export const follows: { followerId: string; followeeId: string; createdAt: Date }[] = [
  { followerId: alice.id, followeeId: bob.id, createdAt },
];

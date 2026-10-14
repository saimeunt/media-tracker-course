/**
 * The storage contract. Routes only talk to these interfaces, so the same REST API
 * runs on the in-memory store (module 1) and on MongoDB (module 2).
 */
import type { EntryStatus, Genre, ListVisibility, Media, MediaImage, MediaQuery, MediaType, UserStats } from "@media-tracker/shared";

export interface User {
  id: string;
  username: string;
  email: string;
  /** See auth/password.ts. Never sent to clients. */
  passwordHash: string;
  createdAt: Date;
}

/** Thrown when a write would break a uniqueness rule (a unique index, in MongoDB). */
export class DuplicateKeyError extends Error {
  readonly field: string;

  constructor(field: string) {
    super(`Duplicate ${field}`);
    this.field = field;
  }
}

export interface ListItemRecord {
  mediaId: string;
  // Copied from the media item when it is added, so a list displays without a lookup.
  type: MediaType;
  title: string;
  year: number | null;
  image: MediaImage | null;
  note: string | null;
  addedAt: Date;
}

export interface ListRecord {
  id: string;
  ownerId: string;
  name: string;
  description: string;
  visibility: ListVisibility;
  items: ListItemRecord[];
  createdAt: Date;
  updatedAt: Date;
}

export interface MediaPage {
  items: Media[];
  /** Sort value and id of the last item, when there is a next page. */
  next: { value: string | number; id: string } | null;
}

export interface MediaRepository {
  /** `after` is the decoded cursor: start after the item with this sort value and id. */
  find(query: Omit<MediaQuery, "cursor">, after: MediaPage["next"]): Promise<MediaPage>;
  findById(id: string): Promise<Media | null>;
  /** The media with these ids, in no particular order (unknown ids are skipped). */
  findByIds(ids: readonly string[]): Promise<Media[]>;
  /** Full-text search on titles and descriptions, best matches first. */
  search(text: string, options: { type?: MediaType; limit: number }): Promise<Media[]>;
  /** Tags with their number of media, most common first. */
  genres(type?: MediaType): Promise<Genre[]>;
}

export interface ListFilter {
  ownerId?: string;
  /** Private lists are only included for their owner. */
  viewerId: string | null;
  skip: number;
  limit: number;
}

export interface ListRepository {
  /** Most recently updated first. */
  find(filter: ListFilter): Promise<{ lists: ListRecord[]; total: number }>;
  findById(id: string): Promise<ListRecord | null>;
  create(list: Pick<ListRecord, "ownerId" | "name" | "description" | "visibility">): Promise<ListRecord>;
  /** Returns null when the list does not exist. */
  update(id: string, patch: Partial<Pick<ListRecord, "name" | "description" | "visibility">>): Promise<ListRecord | null>;
  /** Returns false when the list does not exist. */
  delete(id: string): Promise<boolean>;
  /** Returns false when the media is already in the list. */
  addItem(id: string, item: ListItemRecord): Promise<boolean>;
  /** Returns false when the media is not in the list. */
  removeItem(id: string, mediaId: string): Promise<boolean>;
  replaceItems(id: string, items: ListItemRecord[]): Promise<ListRecord | null>;
}

export interface EntryRecord {
  userId: string;
  mediaId: string;
  // Copied from the media item, so a library displays without a lookup.
  type: MediaType;
  title: string;
  year: number | null;
  status: EntryStatus;
  rating: number | null;
  review: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface EntryFilter {
  userId: string;
  status?: EntryStatus;
  type?: MediaType;
  skip: number;
  limit: number;
}

/** Position of an entry in the order newest first: entries are sorted by (updatedAt, userId, mediaId) descending. */
export interface EntryCursor {
  updatedAt: Date;
  userId: string;
  mediaId: string;
}

export interface EntryPageFilter {
  /** Entries of these users (a library, or a feed). */
  userIds?: string[];
  /** Entries for this media (its reviews). */
  mediaId?: string;
  status?: EntryStatus;
  /** Only entries with a written review. */
  withReview?: boolean;
}

export interface EntryRepository {
  /** Newest first, `first` entries after the cursor. `hasNextPage` tells whether more follow. */
  page(filter: EntryPageFilter, first: number, after: EntryCursor | null): Promise<{ entries: EntryRecord[]; hasNextPage: boolean }>;
  /** Most recently updated first. */
  find(filter: EntryFilter): Promise<{ entries: EntryRecord[]; total: number }>;
  findOne(userId: string, mediaId: string): Promise<EntryRecord | null>;
  /** Creates or replaces a user's entry for a media, and updates the media's stats. */
  upsert(entry: Omit<EntryRecord, "createdAt" | "updatedAt">): Promise<{ entry: EntryRecord; created: boolean }>;
  /** Returns false when there was no entry. Updates the media's stats. */
  delete(userId: string, mediaId: string): Promise<boolean>;
  userStats(userId: string): Promise<UserStats>;
}

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  /** The users with these ids, in no particular order (unknown ids are skipped). */
  findByIds(ids: readonly string[]): Promise<User[]>;
  findByEmail(email: string): Promise<User | null>;
  /** Throws DuplicateKeyError when the username or email is taken. */
  create(user: Pick<User, "username" | "email" | "passwordHash">): Promise<User>;
}

/** Who follows whom. Following is one-way, like on most social networks. */
export interface FollowRepository {
  /** Does nothing if already following. */
  follow(followerId: string, followeeId: string): Promise<void>;
  unfollow(followerId: string, followeeId: string): Promise<void>;
  isFollowing(followerId: string, followeeId: string): Promise<boolean>;
  /** The ids of the users someone follows. */
  followingIds(followerId: string): Promise<string[]>;
  counts(userId: string): Promise<{ followers: number; following: number }>;
}

export interface Store {
  media: MediaRepository;
  lists: ListRepository;
  users: UserRepository;
  entries: EntryRepository;
  follows: FollowRepository;
  /** Checks the storage is reachable (used by GET /api/health). */
  ping(): Promise<void>;
  close(): Promise<void>;
}

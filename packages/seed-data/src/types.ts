export const MEDIA_TYPES = ["movie", "book", "game", "series"] as const;

export type MediaType = (typeof MEDIA_TYPES)[number];

export const IMAGE_KINDS = ["poster", "logo", "image"] as const;

/**
 * A picture of the item: a file from Wikimedia Commons, which only hosts freely licensed files.
 * Linked, not copied: the web app loads it from Wikimedia's servers.
 */
export interface MediaImage {
  /** A thumbnail 500 px wide, on Wikimedia's servers (SVG files are rendered as PNG). */
  url: string;
  /** Which Wikidata property it comes from: poster (P3383), logo (P154) or image (P18). */
  kind: (typeof IMAGE_KINDS)[number];
  /** The file's page on Commons, with its author and full license. */
  sourceUrl: string;
  /** The license as Commons names it, e.g. "Public domain", "CC BY-SA 4.0". */
  license: string;
  /** The author to credit, as plain text, when the license requires it; null otherwise. */
  author: string | null;
}

interface MediaBase {
  /** Wikidata item id, e.g. "Q49740". Stable across snapshots. */
  wikidataId: string;
  type: MediaType;
  title: string;
  /** Short English description from Wikidata (one line). */
  description: string | null;
  /** First release / publication year. */
  year: number | null;
  genres: string[];
  /** Number of Wikipedia language editions with an article about the item. */
  popularity: number;
  /** Null when Wikidata has no usable file for it. */
  image: MediaImage | null;
}

export interface Movie extends MediaBase {
  type: "movie";
  directors: string[];
  cast: string[];
  runtimeMinutes: number | null;
}

export interface Book extends MediaBase {
  type: "book";
  authors: string[];
  /** Original language of the work. */
  language: string | null;
  /** Series the book belongs to, e.g. "Harry Potter". */
  bookSeries: string | null;
}

export interface Game extends MediaBase {
  type: "game";
  developers: string[];
  publishers: string[];
  platforms: string[];
}

export interface Series extends MediaBase {
  type: "series";
  creators: string[];
  endYear: number | null;
  seasons: number | null;
  episodes: number | null;
}

export type Media = Movie | Book | Game | Series;

export interface SnapshotMeta {
  source: string;
  license: string;
  fetchedAt: string;
  counts: Record<MediaType, number>;
}

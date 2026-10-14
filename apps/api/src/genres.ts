/**
 * Genre normalization rules. Wikidata genres mix the genre with the medium ("drama film",
 * "drama television series") and vary in wording. These rules turn them into tags
 * ("drama"), so one genre filter works across movies, books, games and series.
 *
 * The same rules run in JavaScript (in-memory store) and as an aggregation pipeline
 * (MongoDB store, see store/mongodb/pipelines.ts).
 */

/**
 * Captures the genre without a trailing medium. "fiction" is a medium too, except in
 * "science fiction" and "speculative fiction", where it's part of the genre.
 */
export const GENRE_PATTERN =
  "^(.+?)(?: film| television series| television program| video game| game| novel| literature| (?<!science |speculative )fiction)?$";

/** Different names for the same genre, applied after the medium is removed. */
export const GENRE_SYNONYMS: Record<string, string> = {
  romantic: "romance",
  "comedy-drama": "comedy drama",
  suspense: "thriller",
  "lgbt-related": "lgbtq-related",
  "sci-fi": "science fiction",
};

const pattern = new RegExp(GENRE_PATTERN);

export function normalizeGenre(genre: string): string {
  const stem = pattern.exec(genre.trim().toLowerCase())![1]!;
  return GENRE_SYNONYMS[stem] ?? stem;
}

/** The tags of a media item: its genres, normalized, without duplicates. */
export function genreTags(genres: string[]): string[] {
  return [...new Set(genres.map(normalizeGenre))].sort();
}

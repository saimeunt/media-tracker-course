import type { EntryStatus, Media, MediaType } from "@media-tracker/shared";

export const TYPE_LABELS: Record<MediaType, string> = {
  movie: "Movie",
  book: "Book",
  game: "Video game",
  series: "TV series",
};

export const STATUS_LABELS: Record<EntryStatus, string> = {
  planned: "Planned",
  in_progress: "In progress",
  completed: "Completed",
  dropped: "Dropped",
};

/** The people or studios behind a media item, by type. */
export function credits(media: Media): string[] {
  switch (media.type) {
    case "movie":
      return media.directors;
    case "book":
      return media.authors;
    case "game":
      return media.developers;
    case "series":
      return media.creators;
  }
}

/** Wikidata stores years before the common era as negative numbers. */
export function formatYear(year: number) {
  return year < 0 ? `${-year} BC` : String(year);
}

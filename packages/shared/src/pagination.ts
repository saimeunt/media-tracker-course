/** A page of a collection paginated with an opaque cursor. */
export interface CursorPage<T> {
  items: T[];
  /** Pass it back as `?cursor=` to get the next page; null on the last page. */
  nextCursor: string | null;
}

/** A page of a collection paginated with page numbers. */
export interface OffsetPage<T> {
  items: T[];
  page: number;
  limit: number;
  /** Number of items across all pages. */
  total: number;
}

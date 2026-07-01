export interface PaginationMeta {
  nextCursor: string | null;
  hasNextPage: boolean;
}

/**
 * Return this from list handlers instead of a plain array. ResponseEnvelopeInterceptor detects
 * this shape and forwards both data and meta into the success envelope, preventing meta from
 * being nested under data.
 *
 * @example
 *   async list(query: CursorPaginationDto): Promise<PaginatedResult<Organization>> {
 *     return { data: items, meta: { nextCursor: cursor, hasNextPage: true } };
 *   }
 */
export interface PaginatedResult<T> {
  data: T[];
  meta: PaginationMeta;
}

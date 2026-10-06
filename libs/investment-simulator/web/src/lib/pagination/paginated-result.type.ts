export interface PaginatedResult<Item> {
  readonly items: readonly Item[];
  readonly total: number;
  /** One-based page number. */
  readonly page: number;
  readonly pageSize: number;
}

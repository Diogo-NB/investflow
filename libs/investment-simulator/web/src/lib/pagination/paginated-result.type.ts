export interface PaginatedResult<Item> {
  readonly items: readonly Item[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
}

# shared-types

Cross-context compile-time types organized by reusable capability. For example,
identity shapes live under `src/lib/authentication` and pagination contracts under
`src/lib/pagination`. This server-only project is available to backend code.
The frontend defines its own pagination interface inside
`libs/investment-simulator/web/src/lib/pagination` and uses relative imports.
Keep this project free of runtime behavior, framework/Node dependencies, and
feature-context imports; export types through `src/index.ts`.

## Pagination

```ts
import type { PaginatedResult } from '@investflow/shared-types';

type OffersPage = PaginatedResult<Offer>;
```

`PaginatedResult<Item>` has readonly `items: readonly Item[]`, `total: number`,
`page: number` (one-based), and `pageSize: number`. `total` is the number of items
matching the filters, before pagination. An empty page has `items: []`; its
matching total can still be positive when the requested page is out of range.
The interface describes the shape only; request validation and pagination
defaults stay at their owning boundary. Feature item types stay local to each
consumer.

## Building

Run `pnpm nx build shared-types` to build the library.

## Running unit tests

Run `pnpm nx test shared-types` to execute its Jest target. Type-only contracts
are checked by compiling their consumers; no runtime tests are needed for an
interface.

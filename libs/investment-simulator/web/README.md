# investment-simulator-web

This buildable Angular library owns the investment simulator's browser routes,
feature components, and API client. Applications consume only the route array
exported by `src/index.ts`.

## Running unit tests

Run `pnpm nx test investment-simulator-web` to execute the Vitest unit tests.
The tests focus on feature-store state transitions and component orchestration;
template markup and styling are not unit-tested.

# shared-types

Cross-context compile-time types organized by reusable capability. For example,
identity shapes live under `src/lib/authentication`. Keep this project free of
runtime behavior and avoid a flat global type bucket as it grows.

## Building

Run `nx build shared-types` to build the library.

## Running unit tests

Run `nx test shared-types` to execute the unit tests via [Jest](https://jestjs.io).

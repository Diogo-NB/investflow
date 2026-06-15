# Coding Principles

- Prefer guard clauses and early returns over nested conditional trees.
- Use names and structure that explain behavior; comment only non-obvious
  constraints, side effects, and workarounds.
- Do not use `any`. Accept `unknown` and narrow it explicitly unless framework
  typings make `any` unavoidable.
- Aggregate methods with no distinct result return `this` to support fluent
  domain operations.
- Keep edits scoped, preserve project boundaries, and export public APIs through
  each library's `src/index.ts`.

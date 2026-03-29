## ESLint in Nx

### How `@nx/eslint/plugin` Works

`@nx/eslint/plugin` scans for ESLint config files and creates a lint target for each project. It detects both flat config files (`eslint.config.{js,mjs,cjs,ts,mts,cts}`) and legacy config files (`.eslintrc.*`).

Plugin registration in `nx.json`:

```json
{
  "plugin": "@nx/eslint/plugin",
  "options": {
    "targetName": "lint"
  }
}
```

---

### Duplicate `lint` and `eslint:lint` Targets

If a project's `package.json` has a `"lint"` npm script, it will have **two** lint targets after generation:

- `lint` — inferred by `@nx/eslint/plugin`; has proper caching and input/output tracking
- `lint` (npm script) — created by Nx from the npm script via `nx:run-script`; no caching intelligence

**Fix**: Remove the `"lint"` script from the project's `package.json`. Keep `"lint:fix"` if present — there is no plugin-inferred equivalent for auto-fixing.

---

### Flat Config `.cjs` Files Self-Linting

When a project uses `eslint.config.cjs`, `eslint .` lints the config file itself. The `require()` call triggers `@typescript-eslint/no-require-imports`.

**Fix**: Add the config filename to the top-level `ignores` array:

```js
module.exports = tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', 'eslint.config.cjs'],
  },
  // ...
);
```

The same applies to `eslint.config.js` in a CJS project (no `"type": "module"`) if it uses `require()`.

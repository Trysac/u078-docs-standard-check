# Testing

## Tools

- [Vitest](https://vitest.dev/) runs the suites in `test/`.
- Coverage is collected with V8 (`@vitest/coverage-v8`) over `src/`.

## Test files

- `test/index.test.ts` covers the public API through `src/index.ts`: `checkRepo` (DOC001 to DOC008, heading matching with fences, forbidden literals, link resolution and edge cases, word counts, changelog, size limits, finding cap and sort order), `loadManifest` (rejected paths, invalid shapes, size limits, full manifest), `formatFindings` (GitHub escaping and text format), and `createMemoryFs` and `createNodeFs` (including a symlink that leaves the root; skipped when symlink creation fails with EPERM).
- `test/cli.test.ts` covers `run` from `src/cli.ts`: exit codes 0, 1 and 2, both output formats, a custom manifest name, invalid, oversized and over-limit manifests, usage errors, and missing manifest or root.

## Commands

```sh
npm test            # vitest run --coverage
npx vitest          # watch mode while developing
npm run check       # every gate, including tests
```

## Rules

- Coverage must stay at or above 80 % for lines, branches, functions and statements (`vitest.config.ts`). Lowering the thresholds is not allowed.
- Assert observable behavior: return values, thrown errors and their messages, and exit codes.
- Each bug fix adds a test that fails without the fix.
- Tests are deterministic: no network (the link tests stub `fetch` and assert it is never called), no real clock or randomness, and no shared state between tests. Temporary files go to the OS temp directory and are removed by the test.

## Reports

Coverage reports are written to `coverage/` (text summary and `lcov`). The folder is ignored by git.

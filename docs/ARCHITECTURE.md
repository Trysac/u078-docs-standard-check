# Architecture

## Overview

`@trysac/docs-standard-check` is a small, dependency-free TypeScript library published to npm as ES modules with type declarations. It checks that a repository meets a declared documentation standard, given as a JSON manifest.

## Modules

| Module | Responsibility |
|---|---|
| `src/index.ts` | Public entry point; re-exports the API listed in the README. |
| `src/manifest.ts` | Validates untrusted manifest JSON into a typed `Manifest`; exports the internal `pathIssue` check. |
| `src/check.ts` | `checkRepo`: runs DOC001 to DOC008 over a `FileSystemPort`, scans Markdown headings, links and words. |
| `src/format.ts` | `formatFindings`: text and GitHub workflow command output with escaping. |
| `src/memory-fs.ts` | `createMemoryFs`: in-memory `FileSystemPort`. |
| `src/node-fs.ts` | `createNodeFs`: read-only port over a directory, resolving realpaths and rejecting paths outside the root. |
| `src/errors.ts` | `DocsCheckError` and `ManifestError`. |
| `src/types.ts` | Shared types: `Manifest`, `FileSpec`, `Finding`, `FindingCode`, `FileSystemPort`. |
| `src/cli.ts` | `run(argv, io)` command line runner; not re-exported from `src/index.ts`. |

## Boundaries

- No runtime dependencies. Only `src/node-fs.ts` and `src/cli.ts` import `node:` modules.
- `checkRepo` depends only on the `FileSystemPort` interface, so it can run against memory or disk.
- Errors are thrown as `DocsCheckError` or `ManifestError` with a stable `code`.

## Build and distribution

`npm run build` compiles `src/` to `dist/` with `tsconfig.build.json`. Only `dist/` is published (`files` in `package.json`).

## Decisions

Architectural decisions are recorded in [decisions/](decisions/), starting with [0001](decisions/0001-record-architecture-decisions.md).

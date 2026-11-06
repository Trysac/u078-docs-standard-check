# docs-standard-check

[![npm version](https://img.shields.io/npm/v/@trysac/docs-standard-check.svg)](https://www.npmjs.com/package/@trysac/docs-standard-check)
[![license: MIT](https://img.shields.io/npm/l/@trysac/docs-standard-check.svg)](LICENSE)
[![CI](https://github.com/Trysac/u078-docs-standard-check/actions/workflows/ci.yml/badge.svg)](https://github.com/Trysac/u078-docs-standard-check/actions/workflows/ci.yml)

CI check that a repository meets a declared documentation standard: required files, headings, forbidden placeholders and relative links.

## Problem

An organisation defines a documentation standard (README sections, CHANGELOG, security policy), but nothing enforces it, so repositories drift. Markdown linters check style and link checkers check links, not whether the declared files and sections exist. This library and its CLI-style runner read a JSON manifest and report precise findings, so CI fails with annotations when the standard is not met.

## Install

```sh
npm install @trysac/docs-standard-check
```

Requires Node.js 20 or newer. The package ships ES modules with TypeScript declarations and has no runtime dependencies.

## Usage

```ts
import { checkRepo, createNodeFs, formatFindings, loadManifest } from "@trysac/docs-standard-check";

const manifest = loadManifest({
  version: 1,
  files: [{ path: "README.md", headings: ["Usage"] }],
});
const findings = checkRepo(manifest, createNodeFs("."));
process.stdout.write(formatFindings(findings, "text"));
```

## API

| Export | Signature | Description |
|---|---|---|
| `loadManifest` | `(raw: unknown) => Manifest` | Validates untrusted JSON; throws `ManifestError` listing every issue. |
| `checkRepo` | `(manifest: Manifest, fs: FileSystemPort) => Finding[]` | Returns findings sorted by file, line and code. |
| `formatFindings` | `(findings: readonly Finding[], format: "text" \| "github") => string` | Text lines `file:line: CODE message` or GitHub `::error` commands. |
| `createMemoryFs` | `(files: Record<string, string>) => FileSystemPort` | In-memory file system for tests and embedding. |
| `createNodeFs` | `(root: string) => FileSystemPort` | Read-only file system rooted at a directory; symlinks leaving the root count as missing. |

Also exported: the classes `DocsCheckError` (property `code`: `manifest_invalid`, `manifest_too_large` or `path_outside_root`) and `ManifestError` (adds `issues: string[]`, at most 50 entries).

Manifest fields: `version` (must be `1`); `files` (up to 500 entries of `{ path, headings?, minWords? }`); `forbidLiterals` (up to 50 plain substrings of at most 100 characters); `checkLinks` (boolean); `changelog` (`{ path }`, checked for a `## [Unreleased]` heading).

Finding codes: DOC001 required file missing; DOC002 required heading missing; DOC003 forbidden literal found; DOC004 broken relative link; DOC005 fewer words than `minWords`; DOC006 changelog without `## [Unreleased]`; DOC007 file over 1 MiB, reported and not read; DOC008 finding limit reached.

Limits: collection stops at 1000 findings, then one DOC008 finding is appended. Paths must be relative POSIX paths without `..`, backslashes or drive letters. Headings match by whole-text equality after trim and case folding. Fenced code blocks are skipped for headings and links. Links are checked only when `checkLinks` is true; http, https, mailto and `#`-only links are ignored.

Command line: `src/cli.ts` exports `run(argv, io)`, which accepts `--root DIR`, `--manifest FILE` (default `docs-manifest.json`) and `--format text|github`. It returns 0 when clean, 1 with findings, and 2 on usage, IO or parse errors. No binary is declared in `package.json`, and `run` is not re-exported from the package entry point.

## Why not markdownlint

markdownlint and remark-validate-links do not enforce declared files and sections. This utility checks that the files and headings a standard requires exist, and it reports violations as CI annotations.

## Development

```sh
npm install
npm run check   # lint, format, types, tests with coverage, docs, secrets
```

See [AGENTS.md](AGENTS.md) for the full command list and [CONTRIBUTING.md](CONTRIBUTING.md) for the workflow.

## Security

Threat model, limits and secret handling are described in [docs/SECURITY.md](docs/SECURITY.md).

## License

[MIT](LICENSE) © 2026 Miguel Gomez

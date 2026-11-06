# Project record: docs-standard-check

## Objective

Provide a dependency-free TypeScript library and runner that checks a repository against a declared documentation standard (required files, headings, forbidden literals, relative links, minimum word counts and a changelog Unreleased heading), so that CI fails with precise findings when the standard is not met. It is for maintainers who want to keep README, CHANGELOG and security documentation consistent across repositories.

## Scope

In scope:

- The public API documented in the README: `loadManifest`, `checkRepo`, `formatFindings`, `createMemoryFs`, `createNodeFs` and the error classes.
- Finding codes DOC001 to DOC008.
- Text and GitHub workflow command output.
- The `run` command line runner in `src/cli.ts`.

Out of scope:

- Spelling, style and grammar checking.
- Checking external links, anchors and reference-style links.
- Setext headings.
- Automatic fixing of documentation.

## Timeline

| Date | Milestone |
|---|---|
| 2026 | Repository created from the factory utility template. |

## Effort metrics

Values are recorded from the factory ledger and the time log only.

| Metric | Value | Source |
|---|---|---|
| Tokens (input / output) | 37121 / 297520 | factory ledger |
| Hours (human) | pending measurement | time log |
| Cost (USD) | 1.4777 | factory ledger |

## Factory run u078 (measured from API usage)

| Phase | Model | Batch | Input | Output | Cache write | Cache read | Cost (USD) |
|---|---|---|---|---|---|---|---|
| generation | claude-sonnet-5-5 | yes | 2485 | 128000 | 0 | 4473 | 0.6429 |
| generation | claude-sonnet-5-5 | yes | 2485 | 128000 | 4473 | 0 | 0.6514 |
| generation | claude-sonnet-5-5 | yes | 2485 | 33037 | 4473 | 0 | 0.1766 |
| audit | claude-sonnet-5-5 | no | 0 | 0 | 0 | 0 | 0.0000 |
| docs | claude-haiku-5-5 | no | 25193 | 8483 | 0 | 0 | 0.0068 |

Total: $1.4777. Prices: Anthropic list prices.

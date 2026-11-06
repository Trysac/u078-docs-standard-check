# Port-based checker with a bounded finding list

Status: accepted (generated, pending human review)

## Context

A documentation standard must be enforced in CI with precise annotations, deterministically and without network access. The checker must be testable without a disk and safe against hostile repositories (symlinks, huge files, many violations).

## Decision

Split the library into a pure checker working on a FileSystemPort, a validated JSON manifest, formatters and a CLI. Only the node file system adapter and the CLI import node modules. Markdown is scanned with a small CommonMark-subset scanner (ATX headings, fences, code spans, inline links) instead of a dependency. Collection stops at 1000 findings, then results are sorted and a DOC008 finding is appended. Files over 1 MiB are reported, not read; symlinks leaving the root count as missing.

## Consequences

No runtime dependencies and fully deterministic tests. Reference links, setext headings and anchors are intentionally unsupported. Output is bounded in size, and the scanner uses bounded regexes to avoid quadratic behaviour on hostile input.

# Security practices

How this repository keeps the package and its users safe. The disclosure policy is in [../SECURITY.md](../SECURITY.md).

## Threat model

The library reads a manifest and a repository tree supplied by the caller. It writes nothing and makes no network requests.

Defended:

- Manifest paths containing `..`, backslashes, NUL bytes, drive letters or leading slashes are rejected by `loadManifest`.
- `createNodeFs` resolves real paths and treats any path that resolves outside the root, including through symlinks, as missing. Invalid paths passed to it are reported as `path_outside_root` internally and mapped to missing.
- Relative links are resolved against the file directory; a target that climbs above the root is reported as DOC004.
- GitHub workflow output escapes data and property values, so file names and messages cannot inject extra commands.
- Manifest JSON is limited to 64 KiB by the CLI, 500 files and 50 forbidden literals of at most 100 characters.
- Files over 1 MiB are reported as DOC007 and not read; findings stop at 1000.
- Links are never fetched; the checker does not call `fetch`.

Not defended:

- Time-of-check to time-of-use races: a file can be replaced by a symlink between the check and the read.
- Files up to 1 MiB are read fully into memory, and each checked file is scanned in full.
- The text output does not escape control characters in file names.
- The library is not a sandbox. Manifests and repositories are trusted input from the caller; the checker only limits their size and shape.
- Link and heading parsing follows a subset of CommonMark. Documents that rely on unsupported syntax can produce false negatives or positives.

## Secrets

- No secrets, tokens or credentials in the repository, commit history, logs or prompts.
- `gitleaks` runs as the last step of `npm run check` and as a dedicated CI job. Its configuration is `.gitleaks.toml`.
- Publishing credentials live only in the CI secret store or the maintainer's local npm configuration.

## Dependencies

- The library has no runtime dependencies. Development dependencies are limited to the toolchain listed in [STACK.md](STACK.md).
- Dependabot opens weekly updates for npm packages and GitHub Actions.
- Commit the generated `package-lock.json` so installs are reproducible.

## Code

- No `eval`, dynamic `Function` construction or shelling out from library code.
- Inputs from callers are validated and rejected with explicit errors.

## Publishing

- Packages are published from a clean checkout after `npm run check` passes.
- Only `dist/` is included in the published tarball.

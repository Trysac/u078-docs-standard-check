/**
 * Public entry point of @trysac/docs-standard-check.
 *
 * Checks that a repository meets a documentation standard declared in a JSON
 * manifest: required files, headings, forbidden literals and relative links.
 */
export { checkRepo } from "./check.js";
export type { DocsCheckErrorCode } from "./errors.js";
export { DocsCheckError, ManifestError } from "./errors.js";
export { formatFindings } from "./format.js";
export { loadManifest } from "./manifest.js";
export { createMemoryFs } from "./memory-fs.js";
export { createNodeFs } from "./node-fs.js";
export type {
  FileSpec,
  FileSystemPort,
  Finding,
  FindingCode,
  Manifest,
} from "./types.js";

import { DocsCheckError, ManifestError } from "./errors.js";
import type { FileSpec, Manifest } from "./types.js";

const MAX_FILES = 500;
const MAX_LITERALS = 50;
const MAX_TEXT = 100;
const MAX_HEADINGS = 100;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Returns why `p` is not a safe relative POSIX path, or undefined when it is.
 * @internal
 */
export function pathIssue(p: unknown): string | undefined {
  if (typeof p !== "string" || p === "") {
    return "must be a non-empty string";
  }
  if (p.length > 500) {
    return "is too long";
  }
  if (p.includes("\\") || p.includes("\0")) {
    return "must not contain backslashes";
  }
  if (p.startsWith("/") || /^[A-Za-z]:/.test(p)) {
    return "must be relative";
  }
  if (p.split("/").includes("..")) {
    return "must not contain ..";
  }
  return undefined;
}

function readFileSpec(entry: unknown, i: number, issues: string[]): FileSpec | undefined {
  const at = `files[${i}]`;
  if (!isRecord(entry)) {
    issues.push(`${at} must be an object`);
    return undefined;
  }
  const before = issues.length;
  const pi = pathIssue(entry.path);
  if (pi !== undefined) {
    issues.push(`${at}.path ${pi}`);
  }
  let headings: string[] | undefined;
  const h = entry.headings;
  if (h !== undefined) {
    if (
      !Array.isArray(h) ||
      h.length > MAX_HEADINGS ||
      h.some((x) => typeof x !== "string" || x.length > MAX_TEXT)
    ) {
      issues.push(`${at}.headings must be at most 100 strings of at most 100 characters`);
    } else {
      headings = h as string[];
    }
  }
  let minWords: number | undefined;
  const mw = entry.minWords;
  if (mw !== undefined) {
    if (!Number.isInteger(mw) || (mw as number) < 0 || (mw as number) > 1e9) {
      issues.push(`${at}.minWords must be a non-negative integer`);
    } else {
      minWords = mw as number;
    }
  }
  if (issues.length > before) {
    return undefined;
  }
  return {
    path: entry.path as string,
    ...(headings !== undefined ? { headings } : {}),
    ...(minWords !== undefined ? { minWords } : {}),
  };
}

/**
 * Validates untrusted manifest data.
 *
 * @param raw - Parsed JSON.
 * @returns The typed manifest.
 * @throws {ManifestError} When the manifest is invalid.
 * @throws {DocsCheckError} With code `manifest_too_large` over the size limits.
 */
export function loadManifest(raw: unknown): Manifest {
  if (!isRecord(raw)) {
    throw new ManifestError(["manifest must be an object"]);
  }
  const issues: string[] = [];
  if (raw.version !== 1) {
    issues.push("version must be 1");
  }
  const files: FileSpec[] = [];
  if (!Array.isArray(raw.files)) {
    issues.push("files must be an array");
  } else {
    if (raw.files.length > MAX_FILES) {
      throw new DocsCheckError("manifest_too_large", `files exceeds ${MAX_FILES} entries`);
    }
    raw.files.forEach((entry: unknown, i: number) => {
      const spec = readFileSpec(entry, i, issues);
      if (spec !== undefined) {
        files.push(spec);
      }
    });
  }
  let forbidLiterals: string[] | undefined;
  const fl = raw.forbidLiterals;
  if (fl !== undefined) {
    if (Array.isArray(fl) && fl.length > MAX_LITERALS) {
      throw new DocsCheckError(
        "manifest_too_large",
        `forbidLiterals exceeds ${MAX_LITERALS} entries`,
      );
    }
    if (
      !Array.isArray(fl) ||
      fl.some((x) => typeof x !== "string" || x === "" || x.length > MAX_TEXT)
    ) {
      issues.push("forbidLiterals must be non-empty strings of at most 100 characters");
    } else {
      forbidLiterals = fl as string[];
    }
  }
  let checkLinks: boolean | undefined;
  if (raw.checkLinks !== undefined) {
    if (typeof raw.checkLinks === "boolean") {
      checkLinks = raw.checkLinks;
    } else {
      issues.push("checkLinks must be a boolean");
    }
  }
  let changelog: { path: string } | undefined;
  if (raw.changelog !== undefined) {
    const c = raw.changelog;
    const pi = isRecord(c) ? pathIssue(c.path) : "must be an object";
    if (pi !== undefined) {
      issues.push(`changelog.path ${pi}`);
    } else {
      changelog = { path: (c as { path: string }).path };
    }
  }
  if (issues.length > 0) {
    throw new ManifestError(issues);
  }
  return {
    version: 1,
    files,
    ...(forbidLiterals !== undefined ? { forbidLiterals } : {}),
    ...(checkLinks !== undefined ? { checkLinks } : {}),
    ...(changelog !== undefined ? { changelog } : {}),
  };
}

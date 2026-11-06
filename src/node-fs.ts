import { readFileSync, realpathSync, statSync } from "node:fs";
import { resolve, sep } from "node:path";
import { DocsCheckError } from "./errors.js";
import { pathIssue } from "./manifest.js";
import type { FileSystemPort } from "./types.js";

/**
 * Creates a file system rooted at `root`. Paths that resolve (after symlinks)
 * outside the root are treated as missing.
 *
 * @param root - Existing directory.
 * @returns A read-only port.
 */
export function createNodeFs(root: string): FileSystemPort {
  const rootReal = realpathSync(root);
  const locate = (p: string): string | undefined => {
    if (pathIssue(p) !== undefined) {
      throw new DocsCheckError("path_outside_root", "Path is not a safe path");
    }
    let real: string;
    try {
      real = realpathSync(resolve(rootReal, ...p.split("/")));
    } catch {
      return undefined;
    }
    if (real !== rootReal && !real.startsWith(rootReal + sep)) {
      throw new DocsCheckError("path_outside_root", "Path resolves outside the root");
    }
    return real;
  };
  const safe = (p: string): string | undefined => {
    try {
      return locate(p);
    } catch (e) {
      if (e instanceof DocsCheckError) {
        return undefined;
      }
      throw e;
    }
  };
  return {
    exists(path: string): boolean {
      return safe(path) !== undefined;
    },
    readText(path: string): string | undefined {
      const real = safe(path);
      if (real === undefined) {
        return undefined;
      }
      try {
        return readFileSync(real, "utf8");
      } catch {
        return undefined;
      }
    },
    size(path: string): number | undefined {
      const real = safe(path);
      if (real === undefined) {
        return undefined;
      }
      try {
        const st = statSync(real);
        return st.isFile() ? st.size : undefined;
      } catch {
        return undefined;
      }
    },
  };
}

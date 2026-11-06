import type { FileSystemPort } from "./types.js";

/**
 * Creates an in-memory file system.
 *
 * @param files - Map of POSIX relative path to text content.
 * @returns A port; directories exist when any file lives below them.
 */
export function createMemoryFs(files: Record<string, string>): FileSystemPort {
  const map = new Map(Object.entries(files));
  const encoder = new TextEncoder();
  return {
    exists(path: string): boolean {
      if (map.has(path)) {
        return true;
      }
      const prefix = `${path}/`;
      for (const key of map.keys()) {
        if (key.startsWith(prefix)) {
          return true;
        }
      }
      return false;
    },
    readText(path: string): string | undefined {
      return map.get(path);
    },
    size(path: string): number | undefined {
      const t = map.get(path);
      return t === undefined ? undefined : encoder.encode(t).length;
    },
  };
}

/** One required file of the documentation standard. */
export interface FileSpec {
  readonly path: string;
  readonly headings?: readonly string[];
  readonly minWords?: number;
}

/** Validated manifest. */
export interface Manifest {
  readonly version: 1;
  readonly files: readonly FileSpec[];
  readonly forbidLiterals?: readonly string[];
  readonly checkLinks?: boolean;
  readonly changelog?: { readonly path: string };
}

/** Finding codes. */
export type FindingCode =
  | "DOC001"
  | "DOC002"
  | "DOC003"
  | "DOC004"
  | "DOC005"
  | "DOC006"
  | "DOC007"
  | "DOC008";

/** One violation of the standard. */
export interface Finding {
  readonly code: FindingCode;
  readonly file: string;
  readonly line?: number;
  readonly message: string;
}

/** Read-only file system abstraction; paths are POSIX and relative. */
export interface FileSystemPort {
  exists(path: string): boolean;
  readText(path: string): string | undefined;
  size(path: string): number | undefined;
}

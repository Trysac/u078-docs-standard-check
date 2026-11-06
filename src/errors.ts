/** Stable machine-readable error codes. */
export type DocsCheckErrorCode = "manifest_invalid" | "manifest_too_large" | "path_outside_root";

/** Base error of the library. */
export class DocsCheckError extends Error {
  /** Stable machine-readable code. */
  readonly code: DocsCheckErrorCode;

  constructor(code: DocsCheckErrorCode, message: string) {
    super(message.slice(0, 200));
    this.name = "DocsCheckError";
    this.code = code;
  }
}

/** Raised when a manifest is invalid; `issues` lists every problem found. */
export class ManifestError extends DocsCheckError {
  /** Human-readable issues, each starting with the offending JSON path. */
  readonly issues: string[];

  constructor(issues: string[]) {
    super("manifest_invalid", `Invalid manifest: ${issues.slice(0, 3).join("; ")}`);
    this.name = "ManifestError";
    this.issues = issues.slice(0, 50);
  }
}

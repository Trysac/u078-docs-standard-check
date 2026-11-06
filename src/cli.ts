import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { checkRepo } from "./check.js";
import { ManifestError } from "./errors.js";
import { formatFindings } from "./format.js";
import { loadManifest } from "./manifest.js";
import { createNodeFs } from "./node-fs.js";
import type { Manifest } from "./types.js";

const MAX_MANIFEST_BYTES = 65536;
const USAGE = "Usage: docs-standard-check [--root DIR] [--manifest FILE] [--format text|github]\n";

/** Output sinks used by {@link run}. */
export interface CliIo {
  stdout(s: string): void;
  stderr(s: string): void;
}

/**
 * Runs the command line interface.
 *
 * @param argv - Arguments without the program name.
 * @param io - Output sinks.
 * @returns 0 when clean, 1 with findings, 2 on usage, IO or parse errors.
 */
export async function run(argv: string[], io: CliIo): Promise<number> {
  let root = ".";
  let manifestFile = "docs-manifest.json";
  let format: "text" | "github" = "text";
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const v = argv[i + 1];
    if (a !== "--root" && a !== "--manifest" && a !== "--format") {
      io.stderr(`Unknown option\n${USAGE}`);
      return 2;
    }
    if (v === undefined) {
      io.stderr(`Missing value for ${a}\n${USAGE}`);
      return 2;
    }
    i++;
    if (a === "--root") {
      root = v;
    } else if (a === "--manifest") {
      manifestFile = v;
    } else if (v === "text" || v === "github") {
      format = v;
    } else {
      io.stderr(`Invalid format\n${USAGE}`);
      return 2;
    }
  }

  let text: string;
  try {
    const path = resolve(root, manifestFile);
    if (statSync(path).size > MAX_MANIFEST_BYTES) {
      io.stderr("Manifest is larger than 65536 bytes\n");
      return 2;
    }
    text = readFileSync(path, "utf8");
  } catch {
    io.stderr("Cannot read manifest\n");
    return 2;
  }
  let manifest: Manifest;
  try {
    manifest = loadManifest(JSON.parse(text));
  } catch (e) {
    if (e instanceof ManifestError) {
      io.stderr(`${e.issues.join("\n")}\n`);
    } else if (e instanceof SyntaxError) {
      io.stderr("Manifest is not valid JSON\n");
    } else {
      io.stderr("Manifest is invalid\n");
    }
    return 2;
  }
  try {
    const findings = checkRepo(manifest, createNodeFs(root));
    if (findings.length > 0) {
      io.stdout(formatFindings(findings, format));
      return 1;
    }
    return 0;
  } catch {
    io.stderr("Cannot read repository\n");
    return 2;
  }
}

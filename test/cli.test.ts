import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { run } from "../src/cli.js";

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) {
    rmSync(d, { recursive: true, force: true });
  }
});

function setup(manifest: string, files: Record<string, string> = {}): string {
  const d = mkdtempSync(join(tmpdir(), "dsc-cli-"));
  dirs.push(d);
  writeFileSync(join(d, "docs-manifest.json"), manifest);
  for (const [k, v] of Object.entries(files)) {
    writeFileSync(join(d, k), v);
  }
  return d;
}

function io() {
  const out: string[] = [];
  const err: string[] = [];
  return {
    out,
    err,
    io: { stdout: (s: string) => out.push(s), stderr: (s: string) => err.push(s) },
  };
}

const M = JSON.stringify({ version: 1, files: [{ path: "README.md" }] });

describe("run", () => {
  it("returns 0 without findings", async () => {
    const c = io();
    const d = setup(M, { "README.md": "# T" });
    expect(await run(["--root", d], c.io)).toBe(0);
    expect(c.out).toEqual([]);
  });

  it("returns 1 with findings in both formats", async () => {
    const d = setup(M);
    const a = io();
    expect(await run(["--root", d], a.io)).toBe(1);
    expect(a.out.join("")).toBe("README.md: DOC001 Required file README.md is missing\n");
    const b = io();
    expect(await run(["--root", d, "--format", "github"], b.io)).toBe(1);
    expect(b.out.join("")).toContain("::error file=README.md::DOC001");
  });

  it("accepts a custom manifest name", async () => {
    const d = setup("{}", { "m.json": M });
    expect(await run(["--root", d, "--manifest", "m.json"], io().io)).toBe(1);
  });

  it("returns 2 for an invalid manifest", async () => {
    const c = io();
    expect(await run(["--root", setup("{}")], c.io)).toBe(2);
    expect(c.err.join("")).toContain("version must be 1");
    const d = io();
    expect(await run(["--root", setup("{nope")], d.io)).toBe(2);
    expect(d.err.join("")).toContain("not valid JSON");
  });

  it("returns 2 for a too large manifest", async () => {
    const d = setup(" ".repeat(65537));
    expect(await run(["--root", d], io().io)).toBe(2);
  });

  it("returns 2 for a manifest with too many files", async () => {
    const files = Array.from({ length: 501 }, () => ({ path: "a" }));
    const d = setup(JSON.stringify({ version: 1, files }));
    expect(await run(["--root", d], io().io)).toBe(2);
  });

  it("returns 2 for usage errors", async () => {
    expect(await run(["--bogus"], io().io)).toBe(2);
    expect(await run(["--root"], io().io)).toBe(2);
    expect(await run(["--format", "xml"], io().io)).toBe(2);
  });

  it("returns 2 for a missing manifest or root", async () => {
    const d = setup(M);
    expect(await run(["--root", d, "--manifest", "none.json"], io().io)).toBe(2);
    const m = setup(M);
    rmSync(join(m, "docs-manifest.json"));
    expect(await run(["--root", m], io().io)).toBe(2);
    const e = io();
    const f = setup(M);
    writeFileSync(join(f, "x"), "");
    expect(await run(["--root", join(f, "x")], e.io)).toBe(2);
  });
});

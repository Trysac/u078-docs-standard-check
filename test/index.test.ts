import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  checkRepo,
  createMemoryFs,
  createNodeFs,
  DocsCheckError,
  formatFindings,
  loadManifest,
  ManifestError,
} from "../src/index.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

const run = (extra: Record<string, unknown>, files: Record<string, string>) =>
  checkRepo(loadManifest({ version: 1, ...extra }), createMemoryFs(files));

describe("checkRepo", () => {
  it("reports a missing file", () => {
    expect(
      checkRepo(loadManifest({ version: 1, files: [{ path: "README.md" }] }), createMemoryFs({})),
    ).toEqual([
      {
        code: "DOC001",
        file: "README.md",
        message: "Required file README.md is missing",
      },
    ]);
  });

  it("matches headings by whole text and skips fences", () => {
    const m = { files: [{ path: "README.md", headings: ["Usage"] }] };
    expect(run(m, { "README.md": "# T\n\n## usage\n" })).toEqual([]);
    expect(
      run(m, {
        "README.md": "# T\n\n```\n## Usage\n```\n\n## Usage notes\n",
      }),
    ).toEqual([
      {
        code: "DOC002",
        file: "README.md",
        message: "Required heading Usage is missing",
      },
    ]);
    expect(run(m, { "README.md": "~~~\n# Usage\n~~~\n" })).toHaveLength(1);
    expect(run(m, { "README.md": "## Usage ##\n" })).toEqual([]);
    expect(run(m, { "README.md": "#Usage\n" })).toHaveLength(1);
    expect(run(m, { "README.md": "    # Usage\n" })).toHaveLength(1);
  });

  it("reports one DOC003 per literal and line", () => {
    const f = run(
      { files: [{ path: "README.md" }], forbidLiterals: ["__NAME__"] },
      { "README.md": "a\nb\nx __NAME__ __NAME__\n" },
    );
    expect(f).toHaveLength(1);
    expect(f[0]?.code).toBe("DOC003");
    expect(f[0]?.line).toBe(3);
  });

  it("checks relative links only and never fetches", () => {
    const fetchStub = vi.fn(() => {
      throw new Error("network");
    });
    vi.stubGlobal("fetch", fetchStub);
    const f = run(
      { files: [{ path: "README.md" }], checkLinks: true },
      {
        "README.md":
          '[a](docs/missing.md#x). [b](https://example.com) [c](<docs/my%20file.md> "t") `[d](nope.md)`',
        "docs/my file.md": "x",
      },
    );
    expect(f).toHaveLength(1);
    expect(f[0]?.code).toBe("DOC004");
    expect(f[0]?.message).toContain("docs/missing.md");
    expect(fetchStub).not.toHaveBeenCalled();
  });

  it("handles link edge cases", () => {
    const text = [
      "[o](../x.md)",
      "[h](#top) [m](mailto:a@b) [i](docs/ok.md?q=1) ![p](img/none.png)",
      "[e](%E0%A4%A) [t](docs/ok.md 'title') [u](docs/ok.md (t))",
      '[bad](docs/ok.md "unterminated)',
      "[d](docs/) [s](/docs/ok.md) [r](//cdn.x/y) [z]()",
      "```",
      "[f](fenced.md)",
      "```",
    ].join("\n");
    const f = run(
      { files: [{ path: "README.md" }], checkLinks: true },
      { "README.md": text, "docs/ok.md": "x" },
    );
    expect(f.map((x) => `${x.line}:${x.message}`)).toEqual([
      "1:Broken relative link ../x.md",
      "2:Broken relative link img/none.png",
      "3:Broken relative link %E0%A4%A",
    ]);
  });

  it("counts words outside code", () => {
    const m = { files: [{ path: "a.md", minWords: 3 }] };
    expect(run(m, { "a.md": "one two three" })).toEqual([]);
    const f = run(m, { "a.md": "one `two three four`\n```\nx y z\n```" });
    expect(f.map((x) => x.code)).toEqual(["DOC005"]);
  });

  it("checks the changelog", () => {
    const m = { files: [], changelog: { path: "CHANGELOG.md" } };
    expect(run(m, { "CHANGELOG.md": "# C\n\n## [Unreleased]\n" })).toEqual([]);
    expect(run(m, { "CHANGELOG.md": "# C\n\n## 1.0.0\n" })[0]?.code).toBe("DOC006");
    expect(run(m, {})[0]?.code).toBe("DOC001");
    const both = { files: [{ path: "CHANGELOG.md" }], changelog: { path: "CHANGELOG.md" } };
    expect(run(both, {})).toHaveLength(1);
  });

  it("reports oversized files without reading them", () => {
    const big = "x".repeat(1024 * 1024 + 1);
    const f = run({ files: [{ path: "a.md", headings: ["X"] }] }, { "a.md": big });
    expect(f.map((x) => x.code)).toEqual(["DOC007"]);
    const port = {
      exists: () => true,
      size: () => undefined,
      readText: () => big,
    };
    const g = checkRepo(loadManifest({ version: 1, files: [{ path: "a.md" }] }), port);
    expect(g.map((x) => x.code)).toEqual(["DOC007"]);
  });

  it("treats unreadable existing paths as missing", () => {
    const port = { exists: () => true, size: () => undefined, readText: () => undefined };
    const f = checkRepo(loadManifest({ version: 1, files: [{ path: "d" }] }), port);
    expect(f.map((x) => x.code)).toEqual(["DOC001"]);
  });

  it("caps findings at 1000 plus DOC008", () => {
    const m = { files: [{ path: "a.md" }], forbidLiterals: ["__NAME__"] };
    const lines = (n: number) => `${"x __NAME__\n".repeat(n)}`;
    const f = run(m, { "a.md": lines(1500) });
    expect(f).toHaveLength(1001);
    expect(f[1000]).toEqual({
      code: "DOC008",
      file: "",
      message: "Finding limit 1000 reached",
    });
    expect(run(m, { "a.md": lines(1000) })).toHaveLength(1000);
  });

  it("sorts by file, line and code", () => {
    const f = run(
      { files: [{ path: "b.md", headings: ["H"] }, { path: "a.md" }], forbidLiterals: ["X", "Y"] },
      { "b.md": "X\nXY", "a.md": "Y" },
    );
    expect(f.map((x) => `${x.file}:${x.line ?? "-"}:${x.code}`)).toEqual([
      "a.md:1:DOC003",
      "b.md:-:DOC002",
      "b.md:1:DOC003",
      "b.md:2:DOC003",
      "b.md:2:DOC003",
    ]);
  });
});

describe("loadManifest", () => {
  it.each(["../x", "/etc/passwd", "C:/x", "a\\\\b"])("rejects path %s", (p) => {
    try {
      loadManifest({ version: 1, files: [{ path: p }] });
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ManifestError);
      const err = e as ManifestError;
      expect(err.code).toBe("manifest_invalid");
      expect(err.issues[0]?.startsWith("files[0].path")).toBe(true);
    }
  });

  it("rejects other invalid shapes", () => {
    const bad: unknown[] = [
      null,
      [],
      { version: 2, files: [] },
      { version: 1 },
      { version: 1, files: [1] },
      { version: 1, files: [{ path: "" }] },
      { version: 1, files: [{ path: "a", headings: "x" }] },
      { version: 1, files: [{ path: "a", headings: [1] }] },
      { version: 1, files: [{ path: "a", minWords: -1 }] },
      { version: 1, files: [{ path: "a", minWords: 1.5 }] },
      { version: 1, files: [], forbidLiterals: [""] },
      { version: 1, files: [], forbidLiterals: ["x".repeat(101)] },
      { version: 1, files: [], forbidLiterals: "x" },
      { version: 1, files: [], checkLinks: "yes" },
      { version: 1, files: [], changelog: "c" },
      { version: 1, files: [], changelog: { path: "../c" } },
    ];
    for (const b of bad) {
      expect(() => loadManifest(b)).toThrow(ManifestError);
    }
  });

  it("enforces size limits", () => {
    const files = Array.from({ length: 501 }, () => ({ path: "a" }));
    expect(() => loadManifest({ version: 1, files })).toThrow(DocsCheckError);
    try {
      loadManifest({ version: 1, files });
    } catch (e) {
      expect((e as DocsCheckError).code).toBe("manifest_too_large");
    }
    const forbidLiterals = Array.from({ length: 51 }, (_, i) => `l${i}`);
    expect(() => loadManifest({ version: 1, files: [], forbidLiterals })).toThrow(DocsCheckError);
    expect(
      loadManifest({ version: 1, files: Array.from({ length: 500 }, () => ({ path: "a" })) }).files,
    ).toHaveLength(500);
  });

  it("accepts a full manifest", () => {
    const m = loadManifest({
      version: 1,
      files: [{ path: "a.md", headings: ["H"], minWords: 2 }],
      forbidLiterals: ["x"],
      checkLinks: false,
      changelog: { path: "C.md" },
    });
    expect(m.files[0]).toEqual({ path: "a.md", headings: ["H"], minWords: 2 });
    expect(m.changelog?.path).toBe("C.md");
  });
});

describe("formatFindings", () => {
  it("escapes github commands", () => {
    expect(
      formatFindings([{ code: "DOC003", file: "a,b.md", line: 2, message: "bad\nline" }], "github"),
    ).toBe("::error file=a%2Cb.md,line=2::DOC003 bad%0Aline\n");
    expect(formatFindings([{ code: "DOC001", file: "a:b%\r.md", message: "m" }], "github")).toBe(
      "::error file=a%3Ab%25%0D.md::DOC001 m\n",
    );
  });

  it("formats text", () => {
    expect(
      formatFindings(
        [
          { code: "DOC003", file: "a.md", line: 2, message: "m" },
          { code: "DOC001", file: "b.md", message: "n" },
        ],
        "text",
      ),
    ).toBe("a.md:2: DOC003 m\nb.md: DOC001 n\n");
    expect(formatFindings([], "text")).toBe("");
  });
});

describe("file systems", () => {
  it("memory fs handles files and directories", () => {
    const fs = createMemoryFs({ "d/a.md": "héllo" });
    expect(fs.exists("d")).toBe(true);
    expect(fs.exists("e")).toBe(false);
    expect(fs.readText("d/a.md")).toBe("héllo");
    expect(fs.readText("d")).toBeUndefined();
    expect(fs.size("d/a.md")).toBe(6);
    expect(fs.size("d")).toBeUndefined();
  });

  it("node fs reads inside the root only", () => {
    const root = mkdtempSync(join(tmpdir(), "dsc-"));
    try {
      mkdirSync(join(root, "sub"));
      writeFileSync(join(root, "a.md"), "abc");
      const fs = createNodeFs(root);
      expect(fs.exists("a.md")).toBe(true);
      expect(fs.exists("sub")).toBe(true);
      expect(fs.exists("nope.md")).toBe(false);
      expect(fs.exists("../x")).toBe(false);
      expect(fs.readText("a.md")).toBe("abc");
      expect(fs.readText("sub")).toBeUndefined();
      expect(fs.readText("nope.md")).toBeUndefined();
      expect(fs.readText("/etc/passwd")).toBeUndefined();
      expect(fs.size("a.md")).toBe(3);
      expect(fs.size("sub")).toBeUndefined();
      expect(fs.size("nope.md")).toBeUndefined();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("node fs treats a symlink leaving the root as missing", () => {
    const root = mkdtempSync(join(tmpdir(), "dsc-"));
    const outside = mkdtempSync(join(tmpdir(), "dsc-out-"));
    try {
      writeFileSync(join(outside, "secret.md"), "# S\n");
      try {
        symlinkSync(join(outside, "secret.md"), join(root, "README.md"));
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code === "EPERM") {
          return;
        }
        throw e;
      }
      const f = checkRepo(
        loadManifest({ version: 1, files: [{ path: "README.md" }] }),
        createNodeFs(root),
      );
      expect(f.map((x) => x.code)).toEqual(["DOC001"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync(outside, { recursive: true, force: true });
    }
  });
});

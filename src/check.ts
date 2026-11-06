import type { FileSpec, FileSystemPort, Finding, FindingCode, Manifest } from "./types.js";

const MAX_FINDINGS = 1000;
const MAX_FILE_BYTES = 1024 * 1024;
const LINE_BREAK = /\r\n|\n|\r/;
const HEADING = /^ {0,3}(#{1,6})(?:[ \t]+(.*))?$/;
const FENCE_OPEN = /^ {0,3}(`{3,}|~{3,})(.*)$/;
const FENCE_CLOSE = /^ {0,3}(`{3,}|~{3,})[ \t]*$/;

class Stop extends Error {}

interface Heading {
  level: number;
  text: string;
}

interface Scan {
  lines: string[];
  headings: Heading[];
  masked: string;
}

function maskCode(s: string): string {
  const chars = s.split("");
  let i = 0;
  while (i < s.length) {
    if (s[i] !== "`") {
      i++;
      continue;
    }
    let n = 0;
    while (s[i + n] === "`") {
      n++;
    }
    let j = i + n;
    let end = -1;
    while (j < s.length) {
      if (s[j] !== "`") {
        j++;
        continue;
      }
      let m = 0;
      while (s[j + m] === "`") {
        m++;
      }
      if (m === n) {
        end = j + m;
        break;
      }
      j += m;
    }
    if (end < 0) {
      i += n;
      continue;
    }
    for (let k = i; k < end; k++) {
      if (chars[k] !== "\n") {
        chars[k] = " ";
      }
    }
    i = end;
  }
  return chars.join("");
}

function scan(text: string): Scan {
  const lines = text.split(LINE_BREAK);
  const headings: Heading[] = [];
  const body: string[] = [];
  let fence: { ch: string; len: number } | undefined;
  for (const line of lines) {
    if (fence !== undefined) {
      const run = FENCE_CLOSE.exec(line)?.[1];
      if (run !== undefined && run[0] === fence.ch && run.length >= fence.len) {
        fence = undefined;
      }
      body.push("");
      continue;
    }
    const o = FENCE_OPEN.exec(line);
    const run = o?.[1];
    if (run !== undefined && (run[0] === "~" || !(o?.[2] ?? "").includes("`"))) {
      fence = { ch: run[0] ?? "`", len: run.length };
      body.push("");
      continue;
    }
    const h = HEADING.exec(line);
    if (h !== null) {
      headings.push({
        level: (h[1] ?? "").length,
        text: (h[2] ?? "")
          .trim()
          .replace(/(?:^|[ \t]+)#+$/, "")
          .trim(),
      });
    }
    body.push(line);
  }
  return { lines, headings, masked: maskCode(body.join("\n")) };
}

function isWs(c: string | undefined): boolean {
  return c === " " || c === "\t" || c === "\n";
}

function parseDest(s: string, start: number): string | undefined {
  let i = start;
  while (isWs(s[i])) {
    i++;
  }
  let dest: string;
  if (s[i] === "<") {
    i++;
    const st = i;
    while (i < s.length && s[i] !== ">" && s[i] !== "\n" && s[i] !== "<") {
      i++;
    }
    if (s[i] !== ">") {
      return undefined;
    }
    dest = s.slice(st, i);
    i++;
  } else {
    let depth = 0;
    const st = i;
    while (i < s.length) {
      const c = s[i];
      if (c === "\\") {
        i += 2;
        continue;
      }
      if (isWs(c)) {
        break;
      }
      if (c === "(") {
        depth++;
      } else if (c === ")") {
        if (depth === 0) {
          break;
        }
        depth--;
      }
      i++;
    }
    dest = s.slice(st, i);
  }
  while (isWs(s[i])) {
    i++;
  }
  const c = s[i];
  if (c === '"' || c === "'" || c === "(") {
    const close = c === "(" ? ")" : c;
    i++;
    while (i < s.length && s[i] !== close) {
      i++;
    }
    if (i >= s.length) {
      return undefined;
    }
    i++;
    while (isWs(s[i])) {
      i++;
    }
  }
  return s[i] === ")" ? dest : undefined;
}

function extractLinks(masked: string): { dest: string; line: number }[] {
  const re = /!?\[[^\]\n]{0,500}\]\(/g;
  const out: { dest: string; line: number }[] = [];
  let line = 1;
  let pos = 0;
  let m = re.exec(masked);
  while (m !== null) {
    const dest = parseDest(masked, m.index + m[0].length);
    if (dest !== undefined) {
      for (; pos < m.index; pos++) {
        if (masked[pos] === "\n") {
          line++;
        }
      }
      out.push({ dest, line });
    }
    m = re.exec(masked);
  }
  return out;
}

type Target = { kind: "skip" } | { kind: "outside" } | { kind: "path"; path: string };

function resolveTarget(file: string, dest: string): Target {
  const d = dest.trim();
  if (d === "" || d.startsWith("#") || d.startsWith("//") || /^[A-Za-z][A-Za-z0-9+.-]*:/.test(d)) {
    return { kind: "skip" };
  }
  const cut = d.search(/[?#]/);
  let p = cut >= 0 ? d.slice(0, cut) : d;
  if (p === "") {
    return { kind: "skip" };
  }
  try {
    p = decodeURIComponent(p);
  } catch {
    // keep the raw text when the percent-encoding is malformed
  }
  const stack = p.startsWith("/") ? [] : file.split("/").slice(0, -1);
  for (const seg of p.split("/")) {
    if (seg === "" || seg === ".") {
      continue;
    }
    if (seg === "..") {
      if (stack.length === 0) {
        return { kind: "outside" };
      }
      stack.pop();
    } else {
      stack.push(seg);
    }
  }
  if (stack.length === 0) {
    return { kind: "skip" };
  }
  return { kind: "path", path: stack.join("/") };
}

function compare(a: Finding, b: Finding): number {
  if (a.file !== b.file) {
    return a.file < b.file ? -1 : 1;
  }
  const la = a.line ?? 0;
  const lb = b.line ?? 0;
  if (la !== lb) {
    return la - lb;
  }
  if (a.code !== b.code) {
    return a.code < b.code ? -1 : 1;
  }
  return 0;
}

/**
 * Checks a repository against a manifest.
 *
 * @param manifest - Validated manifest.
 * @param fs - File system to read from.
 * @returns Findings sorted by file, line and code; capped at 1000 plus a
 * trailing DOC008 when the cap was reached.
 */
export function checkRepo(manifest: Manifest, fs: FileSystemPort): Finding[] {
  const out: Finding[] = [];
  const add = (code: FindingCode, file: string, message: string, line?: number): void => {
    if (out.length >= MAX_FINDINGS) {
      throw new Stop();
    }
    out.push({ code, file, ...(line !== undefined ? { line } : {}), message });
  };

  const checkFile = (spec: FileSpec, isChangelog: boolean): void => {
    const path = spec.path;
    const missing = (): void => add("DOC001", path, `Required file ${path} is missing`);
    if (!fs.exists(path)) {
      missing();
      return;
    }
    const size = fs.size(path);
    if (size !== undefined && size > MAX_FILE_BYTES) {
      add("DOC007", path, `File ${path} is larger than 1 MiB`);
      return;
    }
    const text = fs.readText(path);
    if (text === undefined) {
      missing();
      return;
    }
    if (text.length > MAX_FILE_BYTES) {
      add("DOC007", path, `File ${path} is larger than 1 MiB`);
      return;
    }
    const sc = scan(text);
    const have = new Set(sc.headings.map((h) => h.text.toLowerCase()));
    for (const want of spec.headings ?? []) {
      if (!have.has(want.trim().toLowerCase())) {
        add("DOC002", path, `Required heading ${want} is missing`);
      }
    }
    if (spec.minWords !== undefined) {
      const words = sc.masked.split(/\s+/).filter((w) => w !== "").length;
      if (words < spec.minWords) {
        add("DOC005", path, `File has ${words} words, minimum is ${spec.minWords}`);
      }
    }
    if (
      isChangelog &&
      !sc.headings.some((h) => h.level === 2 && h.text.toLowerCase() === "[unreleased]")
    ) {
      add("DOC006", path, "Changelog has no ## [Unreleased] heading");
    }
    const literals = manifest.forbidLiterals ?? [];
    if (literals.length > 0) {
      sc.lines.forEach((text1, idx) => {
        for (const lit of literals) {
          if (text1.includes(lit)) {
            add("DOC003", path, `Forbidden literal ${lit} found`, idx + 1);
          }
        }
      });
    }
    if (manifest.checkLinks === true) {
      for (const link of extractLinks(sc.masked)) {
        const t = resolveTarget(path, link.dest);
        if (t.kind === "outside" || (t.kind === "path" && !fs.exists(t.path))) {
          add("DOC004", path, `Broken relative link ${link.dest.slice(0, 100)}`, link.line);
        }
      }
    }
  };

  let truncated = false;
  try {
    for (const spec of manifest.files) {
      checkFile(spec, spec.path === manifest.changelog?.path);
    }
    const cl = manifest.changelog;
    if (cl !== undefined && !manifest.files.some((f) => f.path === cl.path)) {
      checkFile({ path: cl.path }, true);
    }
  } catch (e) {
    if (!(e instanceof Stop)) {
      throw e;
    }
    truncated = true;
  }
  out.sort(compare);
  if (truncated) {
    out.push({
      code: "DOC008",
      file: "",
      message: `Finding limit ${MAX_FINDINGS} reached`,
    });
  }
  return out;
}

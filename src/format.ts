import type { Finding } from "./types.js";

function escapeData(s: string): string {
  return s.replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
}

function escapeProperty(s: string): string {
  return escapeData(s).replace(/:/g, "%3A").replace(/,/g, "%2C");
}

/**
 * Formats findings, one per line.
 *
 * @param findings - Findings to format.
 * @param format - `text` (`file:line: CODE message`) or `github` workflow commands.
 * @returns Output with a trailing LF per finding; empty for no findings.
 */
export function formatFindings(findings: readonly Finding[], format: "text" | "github"): string {
  let out = "";
  for (const f of findings) {
    if (format === "github") {
      const line = f.line !== undefined ? `,line=${f.line}` : "";
      out += `::error file=${escapeProperty(f.file)}${line}::${escapeData(`${f.code} ${f.message}`)}\n`;
    } else {
      const where = f.line !== undefined ? `${f.file}:${f.line}` : f.file;
      out += `${where}: ${f.code} ${f.message}\n`;
    }
  }
  return out;
}

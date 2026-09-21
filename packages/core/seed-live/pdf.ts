// A one-page PDF, written by hand (ADR-144 §1).
//
// The live seed attaches a printable "cheat sheet" to the last lesson of each
// course it creates. Committing a binary PDF per course would be four opaque
// files to keep in step with the prose that describes them; generating them
// from the same strings keeps one source of truth, and a single page of
// Helvetica text needs nothing beyond the PDF 1.4 object model — no library,
// so no new dependency and no install script (security.md #15).
//
// The bytes still go through `storeMedia()`, which sniffs `%PDF-` and applies
// the DOCUMENT size cap exactly as it does for an admin's upload.

/** Escape the three characters that are special inside a PDF literal string. */
function pdfString(text: string): string {
  // Standard 14 fonts use WinAnsi; keep to printable ASCII so every glyph exists.
  const ascii = text
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/[^\x20-\x7E]/g, "");
  return `(${ascii.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)")})`;
}

/** Greedy word wrap at an approximate character budget for 10.5pt Helvetica. */
function wrap(line: string, width: number): string[] {
  const words = line.split(/\s+/).filter(Boolean);
  const out: string[] = [];
  let current = "";
  for (const word of words) {
    if ((current + " " + word).trim().length > width) {
      if (current) out.push(current);
      current = word;
    } else {
      current = `${current} ${word}`.trim();
    }
  }
  if (current) out.push(current);
  return out.length > 0 ? out : [""];
}

/**
 * `title` is drawn large; each entry of `lines` is a paragraph, and a line
 * beginning with "# " is drawn as a bold sub-heading.
 */
export function buildCheatSheetPdf(title: string, lines: string[]): Uint8Array {
  const ops: string[] = ["BT", "/F2 18 Tf", "56 790 Td", `${pdfString(title)} Tj`, "0 -30 Td"];
  let y = 760;
  for (const line of lines) {
    if (y < 60) break;
    if (line.startsWith("# ")) {
      ops.push("0 -8 Td", "/F2 12.5 Tf", `${pdfString(line.slice(2))} Tj`, "0 -18 Td");
      y -= 26;
      continue;
    }
    ops.push("/F1 10.5 Tf");
    for (const part of wrap(line, 92)) {
      ops.push(`${pdfString(part)} Tj`, "0 -15 Td");
      y -= 15;
    }
  }
  ops.push("ET");
  const stream = ops.join("\n");

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] " +
      "/Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
    `<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`,
  ];

  let body = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(body, "latin1"));
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefAt = Buffer.byteLength(body, "latin1");
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) body += `${String(offset).padStart(10, "0")} 00000 n \n`;
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`;
  return new Uint8Array(Buffer.from(body, "latin1"));
}

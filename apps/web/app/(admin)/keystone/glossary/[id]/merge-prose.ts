// changes-46 #1 — a glossary term is ONE rich body.
//
// The term has carried four prose columns since Module 01 (the short
// definition, a fuller explanation, an advanced treatment, a worked example),
// and ADR-069 gave each its own editor. The owner asked for one "Details"
// editor with a Visual / HTML tab. The columns stay in the schema; the editor
// now writes the whole body into `simpleExplanation` — the one REQUIRED column,
// which every surface already reads — and saves the other three as null.
//
// Nothing already written may be lost on the way, so the editor opens on the
// four merged into one document: the short definition first, then each
// non-empty section under the heading the public page already gives it. The
// first Save persists the merge; until then the public page keeps rendering
// the stored columns exactly as before.

export interface GlossaryProse {
  simpleExplanation: string;
  detailedExplanation: string | null;
  advancedExplanation: string | null;
  exampleScenario: string | null;
}

export interface GlossaryProseHeadings {
  detailed: string;
  advanced: string;
  example: string;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** True when a rich-text value holds anything a reader would see. */
function hasContent(html: string | null): html is string {
  if (!html) return false;
  return (
    /<img\b/i.test(html) ||
    html
      .replace(/<[^>]*>/g, "")
      .replace(/&nbsp;/g, " ")
      .trim() !== ""
  );
}

export function mergeGlossaryProse(prose: GlossaryProse, headings: GlossaryProseHeadings): string {
  const sections: [string, string | null][] = [
    [headings.detailed, prose.detailedExplanation],
    [headings.advanced, prose.advancedExplanation],
    [headings.example, prose.exampleScenario],
  ];
  let body = prose.simpleExplanation;
  for (const [heading, html] of sections) {
    if (hasContent(html)) body += `<h2>${escapeHtml(heading)}</h2>${html}`;
  }
  return body;
}

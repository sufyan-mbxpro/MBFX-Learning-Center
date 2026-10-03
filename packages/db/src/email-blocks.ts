// The markup the seeded emails are built from (changes-61, ADR-184).
//
// Each helper writes one piece of the email BLOCK vocabulary that
// `@repo/email`'s layout turns into inline styles: an eyebrow, a headline, a
// button, a tinted panel, a code, a badge. They exist so the English, Arabic
// and design defaults draw one design rather than three copies of it, and
// they emit ONLY markup the admin's visual editor keeps on a re-save:
//
//   * a block class on a `<p>`, `<h2>`/`<h3>` or table cell (the editor's
//     email-block attribute), or a link's own `class`;
//   * one mark per `<span>` — a muted small line is two NESTED spans, because
//     the editor reads one mark from one element;
//   * a panel is a one-cell table, the only container the editor has.
//
// No colour, no size in px: every class resolves against the active theme at
// send time, so a re-brand restyles every template without an edit.

/** The small uppercase line above a headline. */
export function eyebrow(text: string, align: "start" | "center" = "start"): string {
  return align === "center"
    ? `<p class="ed-eyebrow ed-align-center">${text}</p>`
    : `<p class="ed-eyebrow">${text}</p>`;
}

/** The email's headline. */
export function headline(text: string): string {
  return `<h2 class="ed-title">${text}</h2>`;
}

/** A centred button. `href` is a `{{url}}` variable, never a literal. */
export function button(href: string, label: string): string {
  return `<p class="ed-align-center"><a class="ed-btn" href="${href}">${label}</a></p>`;
}

/** A tinted box around one or more blocks. */
export function panel(...blocks: string[]): string {
  return `<table><tbody><tr><td class="ed-panel">${blocks.join("")}</td></tr></tbody></table>`;
}

/** A ticked line inside a panel. */
export function check(html: string): string {
  return `<p><span class="ed-tx-primary"><strong>✓</strong></span> ${html}</p>`;
}

/** A pill: `primary`, `success`, `warning`, `info`, `danger` or `muted`. */
export function badge(tone: string, text: string): string {
  return `<span class="ed-badge-${tone}">${text}</span>`;
}

/** A small muted line, centred by default. */
export function note(html: string, align: "start" | "center" = "center"): string {
  const inner = `<span class="ed-tx-muted"><span class="ed-fs-sm">${html}</span></span>`;
  return align === "center" ? `<p class="ed-align-center">${inner}</p>` : `<p>${inner}</p>`;
}

/** The verification code itself, in a panel with its label above it. */
export function codeBox(label: string, code: string): string {
  return panel(eyebrow(label, "center"), `<p class="ed-code ed-align-center">${code}</p>`);
}

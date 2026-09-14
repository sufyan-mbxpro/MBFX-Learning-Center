"use client";

// Article share row (changes-05 reference screenshot; rebuilt changes-22).
//
// Platform buttons use the standard public share-intent URLs. The marks come
// from `SocialGlyph` (ADR-045, code-style.md #22) — this file's original
// comment said the installed lucide-react no longer ships brand icons and
// therefore fell back to plain text labels, which was true when it was
// written and stopped being true when ADR-045 drew the house set. The footer
// has used those glyphs since; this row was the last labelled-text holdout.
//
// **Why they are round and tinted, and the tags beside them are not.** They
// had been rendering in exactly the tag chips' class — a bordered rectangle
// with 12px text — so the closing row of every article was eight
// indistinguishable pills, half of which navigated to an archive and half of
// which opened a share window. Same shape, same weight, two completely
// different consequences. The share controls are now circular icon buttons on
// a primary tint, which reads as a control rather than as a label, and the
// caller separates the two groups with a rule instead of a gap.
//
// One tint for all four, not each platform's brand colour: brand colours are
// not in the theme, cannot be contrast-checked by the engine (ADR-003), and
// would be the only hard-coded hexes on the public site (code-style.md #1).
// The GLYPH carries the recognition; the tint carries the affordance.
//
// `window.location.href` is read only inside the click handlers, never at
// render time, so there is nothing for SSR/hydration to disagree on.
import { useState } from "react";
import { Check, Link2 } from "lucide-react";
import { SocialGlyph } from "@repo/ui/components/social-glyph";
import { cn } from "@repo/ui/lib/utils";

const BUTTON_CLASS = cn(
  "inline-flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary-interactive ring-1 ring-primary/20",
  "transition duration-(--duration-base) ease-(--ease-out-quint)",
  // Hover promotes the tint to the FILL with its derived foreground — the one
  // pairing ADR-003 guarantees legible, so it carries no contrast risk.
  "hover:-translate-y-0.5 hover:bg-primary hover:text-primary-foreground hover:shadow-sm",
  "focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
);

export function ShareRow({
  title,
  shareLabel,
  facebookLabel,
  twitterLabel,
  linkedinLabel,
  copyLabel,
  copiedLabel,
}: {
  title: string;
  shareLabel: string;
  facebookLabel: string;
  twitterLabel: string;
  linkedinLabel: string;
  copyLabel: string;
  copiedLabel: string;
}) {
  const [copied, setCopied] = useState(false);

  function openIntent(build: (url: string) => string) {
    window.open(build(window.location.href), "_blank", "noopener,noreferrer,width=600,height=500");
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard permission can be denied — the URL is still shareable
      // from the address bar, so this fails silently rather than erroring.
    }
  }

  // Icon-only buttons, so the label IS the accessible name rather than
  // visible text: `aria-label` on each, and a visible group label beside
  // them for everyone else.
  const platforms = [
    {
      glyph: "facebook",
      label: facebookLabel,
      build: (url: string) =>
        `https://www.facebook.com/sharer/sharer.php?${new URLSearchParams({ u: url })}`,
    },
    {
      glyph: "x",
      label: twitterLabel,
      build: (url: string) =>
        `https://twitter.com/intent/tweet?${new URLSearchParams({ url, text: title })}`,
    },
    {
      glyph: "linkedin",
      label: linkedinLabel,
      build: (url: string) =>
        `https://www.linkedin.com/sharing/share-offsite/?${new URLSearchParams({ url })}`,
    },
  ] as const;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-sm font-medium text-foreground">{shareLabel}</span>
      <div className="flex flex-wrap items-center gap-2">
        {platforms.map((platform) => (
          <button
            key={platform.glyph}
            type="button"
            aria-label={platform.label}
            title={platform.label}
            className={BUTTON_CLASS}
            onClick={() => openIntent(platform.build)}
          >
            <SocialGlyph name={platform.glyph} className="size-4.5" />
          </button>
        ))}
        {/* Copy keeps its text: it is the only one whose result is invisible,
            and swapping the label to "Link copied" is the whole feedback. */}
        <button
          type="button"
          onClick={copyLink}
          aria-live="polite"
          className={cn(
            BUTTON_CLASS,
            "w-auto gap-1.5 px-3.5 text-sm font-medium",
            copied && "bg-success/15 text-success-interactive ring-success/30 hover:bg-success/15",
          )}
        >
          {copied ? (
            <Check aria-hidden className="size-4" />
          ) : (
            <Link2 aria-hidden className="size-4" />
          )}
          {copied ? copiedLabel : copyLabel}
        </button>
      </div>
    </div>
  );
}

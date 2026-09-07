// Built-in social platform glyphs (changes-08, ADR-045).
//
// WHY THIS FILE EXISTS: `lucide-react` v1 removed every brand icon —
// Instagram, Facebook, Youtube, Linkedin and Twitter are all gone from the
// package (verified against the installed 1.38.0 type declarations). The
// public footer resolved its social icons by looking a lucide export up by
// name, so after that upgrade every seeded link rendered an EMPTY circle:
// `Icon` was `undefined` and the component returned `null`. Nothing failed
// loudly; the icons just silently disappeared.
//
// The marks below are drawn from primitives (rect / circle / path), not
// traced from any vendor artwork, and are monochrome `currentColor` — they
// identify the destination of a link, which is what a social row is for.
// An admin who wants their own artwork uploads it (ADR-045): a link's
// `iconUrl` always wins over this set, and this set is only the default.
//
// Adding a platform: add a key here and the seed/admin `icon` value that
// names it starts resolving. Unknown keys fall back to a link glyph rather
// than rendering nothing — the ADR-045 rule that this file's absence of a
// key can never again produce an invisible control.
import type { SVGProps } from "react";

import { cn } from "@repo/ui/lib/utils";

export type SocialGlyphName =
  | "instagram"
  | "facebook"
  | "youtube"
  | "linkedin"
  | "x"
  | "tiktok"
  | "telegram"
  | "whatsapp"
  | "link";

const GLYPHS: Record<SocialGlyphName, React.ReactNode> = {
  instagram: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17" cy="7" r="1.15" fill="currentColor" stroke="none" />
    </>
  ),
  facebook: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="4" />
      <path d="M15.5 8.2h-1.6c-.7 0-1.1.4-1.1 1.1v1.6h2.6l-.4 2.7h-2.2V21" />
      <path d="M10 11h2.8" />
    </>
  ),
  youtube: (
    <>
      <rect x="2.5" y="5.5" width="19" height="13" rx="4" />
      <path d="M10.2 9.4v5.2l4.6-2.6z" fill="currentColor" stroke="none" />
    </>
  ),
  linkedin: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <path d="M7.4 10.6V17" />
      <circle cx="7.4" cy="7.6" r="1.1" fill="currentColor" stroke="none" />
      <path d="M11.3 17v-6.4M11.3 13.2c0-1.5 1-2.6 2.5-2.6s2.5 1.1 2.5 2.6V17" />
    </>
  ),
  x: (
    <>
      <path d="M4 4l16 16M20 4L4 20" />
    </>
  ),
  tiktok: (
    <>
      <path d="M14.5 3v9.8a3.6 3.6 0 1 1-3.6-3.6c.3 0 .6 0 .9.1" />
      <path d="M14.5 3c.3 2.3 1.9 3.9 4.2 4.2" />
    </>
  ),
  telegram: (
    <>
      <path d="M21 4.5 2.9 11.4l5.2 1.7L20 5.9l-9.6 8.5.4 5 2.7-3.4 4 3z" />
    </>
  ),
  whatsapp: (
    <>
      <path d="M20.5 11.7a8.5 8.5 0 0 1-12.6 7.5L3.5 20.5l1.4-4.3A8.5 8.5 0 1 1 20.5 11.7z" />
      <path d="M8.9 8.4c.3-.1.6 0 .8.3l.8 1.3c.1.3.1.6-.1.8l-.5.5c.5 1 1.3 1.8 2.3 2.3l.5-.5c.2-.2.5-.2.8-.1l1.3.8c.3.2.4.5.3.8-.3.8-1.1 1.3-2 1.1-2.7-.5-4.8-2.6-5.3-5.3-.2-.9.3-1.7 1.1-2z" />
    </>
  ),
  link: (
    <>
      <path d="M10 13a5 5 0 0 0 7.5.6l2-2a5 5 0 0 0-7-7l-1.1 1.1" />
      <path d="M14 11a5 5 0 0 0-7.5-.6l-2 2a5 5 0 0 0 7 7l1.1-1.1" />
    </>
  ),
};

/** Every glyph this set can draw — used by the admin picker. */
export const SOCIAL_GLYPH_NAMES = Object.keys(GLYPHS) as SocialGlyphName[];

/**
 * True when `name` names a built-in glyph. Callers use it to decide
 * between this set and a lucide lookup without a try/catch dance.
 */
export function isSocialGlyphName(name: string): name is SocialGlyphName {
  return name in GLYPHS;
}

/**
 * Aliases for stored `icon` values that predate this set — the seed shipped
 * `twitter` for the platform now called X, and admins may have typed a
 * platform name that differs from the glyph key.
 */
const ALIASES: Record<string, SocialGlyphName> = {
  twitter: "x",
  "twitter-x": "x",
  fb: "facebook",
  ig: "instagram",
  yt: "youtube",
  "you-tube": "youtube",
  in: "linkedin",
  wa: "whatsapp",
};

/** Resolve a stored `icon` string to a glyph, falling back to the link mark. */
export function resolveSocialGlyph(name: string | null | undefined): SocialGlyphName {
  if (!name) return "link";
  const key = name.trim().toLowerCase();
  if (isSocialGlyphName(key)) return key;
  return ALIASES[key] ?? "link";
}

export function SocialGlyph({
  name,
  className,
  ...props
}: { name: string | null | undefined } & Omit<SVGProps<SVGSVGElement>, "name">) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
      className={cn("size-4 shrink-0", className)}
      {...props}
    >
      {GLYPHS[resolveSocialGlyph(name)]}
    </svg>
  );
}

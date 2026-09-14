// A social link's icon: the admin-uploaded asset when there is one,
// otherwise the built-in glyph named by `icon` (ADR-045).
//
// This used to look the name up as a `lucide-react` export, which resolved to
// `undefined` for every brand icon after lucide v1 removed them — the footer
// rendered five empty circles and said nothing about it. Kept here, beside the
// two surfaces that draw social links (the footer and changes-28's connect
// band), rather than copied into the second one: a fallback rule that exists
// twice is a fallback rule that will be fixed once.
//
// The glyph is always decorative — every call site puts the accessible name on
// the <a> that wraps it.
import { SocialGlyph } from "@repo/ui/components/social-glyph";

export function SocialLinkIcon({ icon, iconUrl }: { icon: string; iconUrl: string | null }) {
  if (iconUrl) {
    // Plain <img>: uploaded assets are served by our own route (ADR-017),
    // and the icon is decorative here — the <a> carries the label.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={iconUrl} alt="" aria-hidden className="size-4 object-contain" />;
  }
  return <SocialGlyph name={icon} />;
}

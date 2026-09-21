import type { BrandAssets } from "@repo/core";
import { AuthBrandPanel } from "@repo/ui/components/auth-split";
import { BrandLogo } from "@repo/ui/components/brand-logo";

// The brand half of the credential screens, shared by the public shell
// (`AuthScreen`) and the staff one (`AdminAuthScreen`). It lives here rather
// than in either surface because the public tree may not import from
// `(admin)` (architecture.md #5), and both need the identical panel.
//
// Both logos are the admin-uploaded brand logo the header and footer draw —
// never a fixed image — so a rebrand reaches these screens too.
export function authBrand({
  logoAlt,
  brandAssets,
  wordmark,
  tagline,
}: {
  logoAlt: string;
  brandAssets: BrandAssets;
  /** The site's full name, printed large on the panel. */
  wordmark: string;
  tagline: string;
}) {
  const light = brandAssets.logo_light?.url ?? null;
  const dark = brandAssets.logo_dark?.url ?? null;

  const panel = (
    <AuthBrandPanel
      // The panel is --secondary, the opposite of the page's own mode, so it
      // takes the logos SWAPPED — the footer's reasoning, same band.
      logo={
        <BrandLogo
          light={dark}
          dark={light}
          alt={logoAlt}
          className="h-16"
          fallback={<span className="text-2xl font-semibold">{wordmark}</span>}
        />
      }
      wordmark={wordmark}
      tagline={tagline}
    />
  );

  // Above the form heading: the header's own logo, same variants, same mode.
  const mark = (
    <div className="flex">
      <BrandLogo
        light={light}
        dark={dark}
        alt={logoAlt}
        className="h-12"
        fallback={<span className="text-xl font-semibold">{wordmark}</span>}
      />
    </div>
  );

  return { panel, mark };
}

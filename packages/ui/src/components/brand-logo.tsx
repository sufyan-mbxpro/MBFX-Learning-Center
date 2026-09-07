// The admin-uploaded site logo, wherever a logo appears — public header,
// public footer, admin sidebar, admin mobile nav, sign-in. Presentational
// only: @repo/ui takes no dependency on @repo/core, so the caller resolves
// `getBrandAssets()` on the server and passes URLs down (architecture.md
// #10). That also keeps this usable from a future ui-native package with a
// different image element.
//
// Extracted because the light/dark swap was hand-written at four call
// sites with subtly different logic — the footer swapped which variant was
// the base, and one site omitted the single-variant case entirely, so a
// brand with only a dark logo rendered nothing there in light mode. The
// rule is stated once here:
//
//   both variants  -> light is the base, dark: swaps it out
//   one variant    -> it shows in BOTH modes (a logo is better than none)
//   neither        -> the `fallback` node (usually the site name)
//
// <img> rather than next/image deliberately: these are served by our own
// /uploads route (ADR-017), so there is no optimizer allowlist to maintain
// and no layout-shift win to be had from a known-at-build size we don't
// have.
import { cn } from "@repo/ui/lib/utils";

function BrandLogo({
  light,
  dark,
  alt,
  fallback,
  className,
}: {
  /** Light-mode logo URL, or null when the admin hasn't uploaded one. */
  light: string | null;
  /** Dark-mode logo URL, or null. */
  dark: string | null;
  alt: string;
  /** Rendered when neither variant is set — normally the site name. */
  fallback?: React.ReactNode;
  /** Sizing for the <img> itself, e.g. "h-8 w-auto". */
  className?: string;
}) {
  if (!light && !dark) return <>{fallback}</>;

  const both = Boolean(light && dark);
  return (
    <>
      {light && (
        <img
          data-slot="brand-logo"
          src={light}
          alt={alt}
          className={cn("w-auto object-contain", both && "dark:hidden", className)}
        />
      )}
      {/* Both variants carry the same `alt`, not alt="" on one of them:
          the inactive variant is `display:none`, which already removes it
          from the accessibility tree, so whichever one is showing is the
          one announced. Hiding the alt instead would leave dark mode with
          an unlabelled logo. */}
      {dark && (
        <img
          data-slot="brand-logo"
          src={dark}
          alt={alt}
          className={cn("w-auto object-contain", both && "hidden dark:block", className)}
        />
      )}
    </>
  );
}

export { BrandLogo };

// The credential screens' shell (sign-in, sign-up and password recovery, on
// both surfaces): a brand panel beside the form, on one rounded frame.
//
// Presentational only, like BrandLogo: @repo/ui takes no dependency on
// @repo/core or a catalog, so the caller resolves the logo, the mark and every
// word and passes them in (architecture.md #10).
//
// The panel is `--secondary`, the band the footer and the homepage hero use,
// so it flips with the mode exactly as they do — a panel that stayed dark in
// dark mode would need a colour the theme does not define. The form column
// sits on `--background` under a faint checker, and the panel is hidden below
// `lg`: on a phone the form IS the screen, and a decorative half above it
// would push the first field below the fold.
import { cn } from "@repo/ui/lib/utils";

function AuthSplit({
  panel,
  mark,
  title,
  description,
  children,
  footer,
  topEnd,
  className,
}: {
  /** The brand panel's content — see `AuthBrandPanel`. */
  panel: React.ReactNode;
  /** The small mark tile above the heading. */
  mark?: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
  /** Links under the form ("Forgot your password?", "Create an account"). */
  footer?: React.ReactNode;
  /** A control pinned to the form column's top end, e.g. the mode toggle. */
  topEnd?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      data-slot="auth-split"
      className={cn(
        "grid w-full max-w-6xl grid-cols-1 gap-2 rounded-xl border bg-card p-2 shadow-card lg:grid-cols-2",
        className,
      )}
    >
      <div className="hidden lg:block">{panel}</div>
      <div className="bg-checker relative flex min-h-160 items-center justify-center overflow-hidden rounded-lg bg-background px-6 py-12 text-foreground sm:px-12">
        {topEnd && <div className="absolute end-4 top-4">{topEnd}</div>}
        <div className="relative flex w-full max-w-sm flex-col gap-6">
          {mark}
          <div className="flex flex-col gap-2">
            <h1 className="font-display text-4xl font-bold tracking-tight">{title}</h1>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
          {children}
          {footer}
        </div>
      </div>
    </div>
  );
}

function AuthBrandPanel({
  logo,
  wordmark,
  tagline,
}: {
  /** The site logo — the same uploaded mark the header and footer draw. */
  logo: React.ReactNode;
  /** The large display name — the site's name. */
  wordmark: string;
  /** The closing sentence at the panel's foot. */
  tagline: string;
}) {
  return (
    <div
      data-slot="auth-brand-panel"
      className="relative isolate flex h-full min-h-160 flex-col justify-between overflow-hidden rounded-lg bg-secondary p-10 text-secondary-foreground"
    >
      {/* Two brand-tinted washes and a soft highlight: large-area fills
          (ADR-018 rule 5), mixed from existing tokens, no new hue. */}
      <div aria-hidden className="auth-panel-glow absolute inset-0 -z-10" />

      <div className="flex">{logo}</div>

      <p className="auth-wordmark font-display text-5xl leading-tight font-extrabold tracking-tight">
        {wordmark}
      </p>

      <p className="max-w-sm text-2xl leading-snug font-semibold">{tagline}</p>
    </div>
  );
}

export { AuthBrandPanel, AuthSplit };

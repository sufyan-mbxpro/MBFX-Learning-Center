import { getBrandAssets } from "@repo/core";
import { getSetting } from "@repo/settings";
import { BrandLogo } from "@repo/ui/components/brand-logo";

// The shell the three staff credential screens share (changes-21 F6).
//
// The sign-in page wrote this markup first; forgot-password and reset-password
// would have made three copies, so it moves here. No session read, no
// AdminShell, no navigation — every screen in `(admin-auth)` is reachable
// unauthenticated by design (ADR-052, ADR-079 #3), so it exposes nothing but
// its form.
//
// Strings come from the `admin` namespace, which is English-only by design
// (ADR-043 #2): the surface is staff-facing, so no non-English value is owed
// and `check:catalog-completeness` stays silent about it.
export async function AdminAuthScreen({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const [siteName, brandAssets] = await Promise.all([getSetting("site.name"), getBrandAssets()]);

  return (
    <main className="flex min-h-dvh flex-1 items-center justify-center bg-background p-6">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex justify-center">
          <BrandLogo
            light={brandAssets.logo_light?.url ?? null}
            dark={brandAssets.logo_dark?.url ?? null}
            alt={siteName ?? ""}
            className="h-14"
            fallback={<span className="text-lg font-semibold tracking-tight">{siteName}</span>}
          />
        </div>
        <div className="flex flex-col gap-6 rounded-xl border bg-card p-8 shadow-card">
          <div className="flex flex-col gap-1.5">
            <h1 className="text-xl font-semibold">{title}</h1>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
          {children}
          {footer}
        </div>
      </div>
    </main>
  );
}

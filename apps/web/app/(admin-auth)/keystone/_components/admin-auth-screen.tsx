import { getTranslations } from "next-intl/server";
import { getBrandAssets } from "@repo/core";
import { getSetting } from "@repo/settings";
import { BrandLogo } from "@repo/ui/components/brand-logo";
import { ModeToggle } from "@repo/ui/components/mode-toggle";

// The shell the three staff credential screens share (changes-21 F6). No
// session read, no AdminShell, no navigation — every screen in `(admin-auth)`
// is reachable unauthenticated by design (ADR-052, ADR-079 #3), so it exposes
// nothing but its form.
//
// **One centred card, not the public split frame (changes-45).** The owner's
// reference for the staff portal is a plain card on a quiet ground — the logo,
// "Admin Portal", the form, a way back to the learner screen — and the public
// credential screens keep the brand-panel split frame unchanged. The two
// surfaces now LOOK different on purpose: someone who reaches this card has
// followed an address nobody on the public site linked them to.
//
// This surface has no header, so the mode toggle sits in the page's corner:
// the mode is the user's to set (ADR-008) on every screen.
//
// Strings come from the `admin` namespace, which is English-only by design
// (ADR-043 #2).
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
  const [t, common, siteName, brandAssets] = await Promise.all([
    getTranslations("admin"),
    getTranslations("common"),
    getSetting("site.name"),
    getBrandAssets(),
  ]);
  // `site.name`, the brand every other surface prints; the catalog's is the
  // fallback for an unseeded row.
  const wordmark = siteName?.trim() || common("siteName");

  return (
    <main className="relative flex min-h-dvh flex-1 items-center justify-center bg-muted/50 p-4 sm:p-8">
      <div className="absolute end-4 top-4">
        <ModeToggle label={t("toggleTheme")} />
      </div>

      <div
        data-slot="admin-auth-card"
        className="flex w-full max-w-md flex-col gap-6 rounded-xl border bg-card p-6 text-card-foreground shadow-xl sm:p-8"
      >
        <div className="flex flex-col items-center gap-4 text-center">
          {/* The header's own uploaded logo, never a fixed image, so a rebrand
              reaches this screen too. */}
          <BrandLogo
            light={brandAssets.logo_light?.url ?? null}
            dark={brandAssets.logo_dark?.url ?? null}
            alt={siteName ?? wordmark}
            className="h-16"
            fallback={<span className="text-2xl font-semibold">{wordmark}</span>}
          />
          <div className="flex flex-col gap-1.5">
            <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        </div>

        <div className="flex flex-col gap-4">{children}</div>

        {footer}
      </div>
    </main>
  );
}

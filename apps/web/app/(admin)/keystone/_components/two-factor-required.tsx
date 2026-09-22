import { getTranslations } from "next-intl/server";
import { loadOwnProfile } from "@repo/core";
import { getSetting } from "@repo/settings";
import { Toaster } from "@repo/ui/components/sonner";
import { SignOutButton } from "./sign-out-button.tsx";
import { TwoFactorSection } from "./two-factor-section.tsx";

/**
 * What the admin layout renders IN PLACE OF the portal while
 * `security.requireStaffTwoFactor` holds this staff member (ADR-157 §4).
 *
 * There is no shell, because every sidebar link would lead back to this same
 * screen. The two ways out are enrolling, after which `router.refresh()`
 * re-renders the layout and the portal appears where they already were, and
 * signing out. Nothing here is the boundary: `requirePermission` refuses every
 * mutation this staff member attempts from anywhere, this screen or not.
 */
export async function TwoFactorRequiredScreen({ userId }: { userId: string }) {
  const [t, siteName, profile] = await Promise.all([
    getTranslations("admin.twoFactor"),
    getSetting("site.name"),
    loadOwnProfile(userId),
  ]);

  return (
    <main className="flex min-h-dvh flex-1 items-center justify-center bg-muted/50 p-4 sm:p-8">
      <div
        data-slot="two-factor-required"
        className="flex w-full max-w-lg flex-col gap-6 rounded-xl border bg-card p-6 text-card-foreground shadow-xl sm:p-8"
      >
        <div className="flex flex-col gap-1.5">
          <h1 className="text-2xl font-bold tracking-tight">{t("required.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("required.description")}</p>
        </div>
        <TwoFactorSection
          enabled={false}
          required
          hasPassword={profile?.hasPassword ?? false}
          issuer={siteName ?? ""}
        />
        <SignOutButton label={t("required.signOut")} />
      </div>
      <Toaster />
    </main>
  );
}

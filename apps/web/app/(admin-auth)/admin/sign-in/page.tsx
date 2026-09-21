import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AdminAuthScreen } from "../_components/admin-auth-screen.tsx";
import { AdminSignInForm } from "./admin-sign-in-form.tsx";

// Staff credential screen (ADR-052). Posts to Better Auth's
// /api/auth/sign-in/email — the ONLY correct entry point, because rate
// limiting and the lockout hooks live on that HTTP handler (ADR-001
// finding #4), not on anything this page could wrap around it.
//
// Strings come from the `admin` namespace, which is English-only by design
// (ADR-043 #2) — the surface is staff-facing, so no non-English value is
// owed and `check:catalog-completeness` stays silent about it.
export default async function AdminSignInPage() {
  const t = await getTranslations("admin");

  return (
    <AdminAuthScreen
      title={t("signIn.title")}
      description={t("signIn.description")}
      footer={
        // The way back for a learner who landed here (changes-45). It points
        // at the PUBLIC screen, which is allowed — what ADR-052 forbids is the
        // opposite direction. The target is under another root layout, so
        // Next makes this a full document load on its own.
        <p className="text-center text-sm">
          <Link
            href="/sign-in"
            className="font-medium text-foreground underline underline-offset-4 hover:text-primary-interactive"
          >
            {t("signIn.userSignIn")}
          </Link>
        </p>
      }
    >
      <AdminSignInForm
        labels={{
          email: t("signIn.email"),
          password: t("signIn.password"),
          showPassword: t("showPassword"),
          hidePassword: t("hidePassword"),
          submit: t("signIn.submit"),
          failed: t("signIn.failed"),
          notStaff: t("signIn.notStaff"),
          resetDone: t("passwordReset.resetDone"),
        }}
      />
      <p className="-mt-2 text-end text-sm">
        <Link
          href="/admin/forgot-password"
          className="font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          {t("passwordReset.forgotLink")}
        </Link>
      </p>
    </AdminAuthScreen>
  );
}

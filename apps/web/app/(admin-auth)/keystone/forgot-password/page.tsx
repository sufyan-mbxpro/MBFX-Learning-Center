import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AdminAuthScreen } from "../_components/admin-auth-screen.tsx";
import { AdminForgotPasswordForm } from "./admin-forgot-password-form.tsx";

// Staff password recovery (ADR-079 #3). One of the three `/keystone` paths the
// proxy's `ADMIN_PUBLIC_PATHS` lets through unauthenticated — gating it would
// redirect it to a sign-in screen the person cannot get past, which is the
// situation they came here to fix.
//
// Typing an address here does not make the link an admin link: `@repo/auth`
// routes by `user.userType`, so a learner who reaches this screen still
// receives a public link and learns nothing about the portal (ADR-079 #2).
export default async function AdminForgotPasswordPage() {
  const t = await getTranslations("admin");

  return (
    <AdminAuthScreen
      title={t("passwordReset.forgotTitle")}
      description={t("passwordReset.forgotDescription")}
      footer={
        <p className="text-center text-sm text-muted-foreground">
          <Link
            href="/keystone"
            className="font-medium text-primary-interactive underline-offset-4 hover:underline"
          >
            {t("passwordReset.backToSignIn")}
          </Link>
        </p>
      }
    >
      <AdminForgotPasswordForm
        labels={{
          email: t("signIn.email"),
          submit: t("passwordReset.forgotSubmit"),
          sent: t("passwordReset.forgotSent"),
          sentAgain: t("passwordReset.sendAgain"),
        }}
      />
    </AdminAuthScreen>
  );
}

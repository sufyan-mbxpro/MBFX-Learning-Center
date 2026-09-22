import { getTranslations } from "next-intl/server";
import { MIN_PASSWORD_LENGTH } from "@repo/contracts";
import { AdminAuthScreen } from "../_components/admin-auth-screen.tsx";
import { AdminResetPasswordForm } from "./admin-reset-password-form.tsx";

// Where a STAFF reset link lands (ADR-079 #2) — `/keystone/reset-password` (served here by the proxy, ADR-146).
//
// The third entry in the proxy's `ADMIN_PUBLIC_PATHS`: someone arriving here
// has no session by definition, and gating the screen would make the link
// useless. The gate is still a gate — `(admin)`'s layout is the boundary, and
// nothing under it is reachable from this route group (security.md #3).
export default async function AdminResetPasswordPage() {
  const t = await getTranslations("admin");

  return (
    <AdminAuthScreen
      title={t("passwordReset.resetTitle")}
      description={t("passwordReset.resetDescription")}
    >
      <AdminResetPasswordForm
        minPasswordLength={MIN_PASSWORD_LENGTH}
        labels={{
          password: t("passwordReset.newPassword"),
          confirm: t("passwordReset.confirmPassword"),
          showPassword: t("showPassword"),
          hidePassword: t("hidePassword"),
          passwordHint: t("passwordReset.passwordHint", { count: MIN_PASSWORD_LENGTH }),
          submit: t("passwordReset.resetSubmit"),
          mismatch: t("passwordReset.mismatch"),
          tooShort: t("passwordReset.passwordHint", { count: MIN_PASSWORD_LENGTH }),
          invalidToken: t("passwordReset.invalidToken"),
          missingToken: t("passwordReset.missingToken"),
          requestAnother: t("passwordReset.requestAnother"),
          failed: t("passwordReset.failed"),
        }}
      />
    </AdminAuthScreen>
  );
}

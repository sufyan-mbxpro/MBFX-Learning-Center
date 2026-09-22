import { getTranslations } from "next-intl/server";
import { loadEmailTransportView } from "@repo/core";
import { can, requirePermission } from "@repo/rbac";
import { EmailTransportForm } from "../../email-transport-form.tsx";
import { EmailDeliveryReadOnly } from "../../email-delivery-readonly.tsx";

// Email → Delivery (Module 17, ADR-078; a tab of its own since changes-51).
// The transport is a different permission level from everything else in the
// email section, which is why it is a tab and not a field of the Sender form.
//
// **The split is the point (ADR-078 #4).** Sender identity and newsletter
// placement are ordinary settings, saved under `settings.update`, so any admin
// edits them. The TRANSPORT — driver, host, port, security, credentials — needs
// `email.settings.manage`, which only `super_admin` holds, because repointing
// the host captures the next password-reset link for anyone, walking around
// `canAssignRole`'s strict `<`. Without that key the editable form is ABSENT
// rather than disabled, and a read-only summary takes its place: knowing where
// mail leaves from is useful, being able to move it is the escalation.
export default async function EmailDeliveryPage() {
  const subject = await requirePermission("settings.view");
  const t = await getTranslations("admin");
  const canManageTransport = can(subject, "email.settings.manage");

  const transport = await loadEmailTransportView();

  return (
    <>
      {canManageTransport ? (
        <EmailTransportForm
          transport={transport}
          labels={{
            section: t("email.deliverySection"),
            sectionDescription: t("email.deliveryDescription"),
            driver: t("email.driver"),
            driverHint: t("email.driverHint"),
            driverSmtp: t("email.driverSmtp"),
            driverSendgrid: t("email.driverSendgrid"),
            sendgridKey: t("email.sendgridKey"),
            sendgridKeyHint: t("email.sendgridKeyHint"),
            sandbox: t("email.sandbox"),
            sandboxHint: t("email.sandboxHint"),
            sandboxOnTitle: t("email.sandboxOnTitle"),
            sandboxOnBody: t("email.sandboxOnBody"),
            driverLog: t("email.driverLog"),
            host: t("email.host"),
            port: t("email.port"),
            security: t("email.security"),
            securityNone: t("email.securityNone"),
            securityStarttls: t("email.securityStarttls"),
            securityTls: t("email.securityTls"),
            username: t("email.username"),
            password: t("email.password"),
            passwordSaved: t("email.passwordSaved"),
            passwordHint: t("email.passwordHint"),
            clearPassword: t("email.clearPassword"),
            showPassword: t("showPassword"),
            hidePassword: t("hidePassword"),
            save: t("save"),
            saved: t("saved"),
            test: t("email.testConnection"),
            testOk: t("email.testOk"),
            lastVerified: t("email.lastVerified"),
            lastError: t("email.lastError"),
            never: t("email.never"),
            secretKeyMissingTitle: t("email.secretKeyMissingTitle"),
            secretKeyMissingBody: t("email.secretKeyMissingBody"),
            confirmClearTitle: t("email.confirmClearTitle"),
            confirmClearBody: t("email.confirmClearBody"),
            confirm: t("confirm"),
            cancel: t("cancel"),
          }}
        />
      ) : (
        <EmailDeliveryReadOnly
          transport={transport}
          labels={{
            section: t("email.deliverySection"),
            restricted: t("email.deliveryRestricted"),
            driver: t("email.driver"),
            host: t("email.host"),
            security: t("email.security"),
            username: t("email.username"),
            lastVerified: t("email.lastVerified"),
            never: t("email.never"),
            notSet: t("email.notSet"),
            sandbox: t("email.sandbox"),
            sandboxActive: t("email.sandboxActive"),
          }}
        />
      )}
    </>
  );
}

import { getTranslations } from "next-intl/server";
import { loadAdminMenus, loadEmailTransportView } from "@repo/core";
import { getActiveLocales } from "@repo/i18n";
import { can, requirePermission } from "@repo/rbac";
import { AdminSection } from "../../_components/admin-page.tsx";
import { SettingsScreen } from "../_components/settings-screen.tsx";
import { groupDescription, groupLabel, loadSettingsIndex } from "../_components/settings-shared.ts";
import { SettingsGroupForm } from "../settings-group-form.tsx";
import { EmailTransportForm } from "./email-transport-form.tsx";
import { EmailDeliveryReadOnly } from "./email-delivery-readonly.tsx";

// Email settings (Module 17, ADR-078). A static route that wins over
// `settings/[group]` the way `social/` already does, because this group needs
// more than type-driven fields: the transport is a different permission level
// from everything else on the screen.
//
// **The split is the point (ADR-078 #4).** Sender identity and newsletter
// placement are ordinary settings, saved under `settings.update`, so any admin
// edits them. The TRANSPORT — driver, host, port, security, credentials — needs
// `email.settings.manage`, which only `super_admin` holds, because repointing
// the host captures the next password-reset link for anyone, walking around
// `canAssignRole`'s strict `<`. Without that key the editable form is ABSENT
// rather than disabled, and a read-only summary takes its place: knowing where
// mail leaves from is useful, being able to move it is the escalation.
export default async function EmailSettingsPage() {
  const subject = await requirePermission("settings.view");
  const t = await getTranslations("admin");
  const canManageTransport = can(subject, "email.settings.manage");

  const [{ settings, navEntries }, locales, menus, transport] = await Promise.all([
    loadSettingsIndex(subject, t),
    getActiveLocales(),
    loadAdminMenus(),
    loadEmailTransportView(),
  ]);

  const group = settings.filter((s) => s.groupName === "email");
  // Two sections out of one registry group: a sender address and "show the
  // signup form in the footer" are different questions, and one Save over both
  // reads as a single decision (ADR-044 #8).
  const sender = group.filter((s) => s.key.startsWith("email."));
  const placements = group.filter((s) => s.key.startsWith("newsletter."));

  const localeOptions = locales.map((l) => ({
    code: l.code,
    name: l.name,
    nativeName: l.nativeName,
  }));
  const menuOptions = menus.map((m) => ({ value: m.key, label: m.name }));
  const formLabels = {
    save: t("save"),
    saved: t("saved"),
    publicBadge: t("publicBadge"),
    privateBadge: t("privateBadge"),
    selectPlaceholder: t("selectPlaceholder"),
    managedElsewhere: t("settingManagedElsewhere"),
    upload: {
      upload: t("uploadImage"),
      replace: t("replaceImage"),
      remove: t("removeImage"),
      uploading: t("uploading"),
      hint: t("uploadHint"),
      cancel: t("cancel"),
      confirmRemoveTitle: t("confirmRemoveImageTitle"),
      confirmRemoveBody: t("confirmRemoveImageBody"),
    },
    fields: {
      addRow: t("fieldAddRow"),
      removeRow: t("fieldRemoveRow"),
      emptyList: t("fieldEmptyList"),
      selectPlaceholder: t("selectPlaceholder"),
      cancel: t("cancel"),
      confirmRemoveTitle: t("confirmRemoveRowTitle"),
      confirmRemoveBody: t("confirmRemoveRowBody"),
      field: {
        fieldEnabled: t("fieldEnabled"),
        fieldPhone: t("fieldPhone"),
        fieldPromoText: t("fieldPromoText"),
        fieldPromoUrl: t("fieldPromoUrl"),
        fieldLabel: t("fieldLabel"),
        fieldUrl: t("fieldUrl"),
        fieldText: t("fieldText"),
        fieldDismissible: t("fieldDismissible"),
        fieldPlatform: t("fieldPlatform"),
        fieldMenu: t("fieldMenu"),
      },
    },
  };

  return (
    <SettingsScreen
      navHeading={t("settingsCategories")}
      navEntries={navEntries}
      title={groupLabel(t, "email")}
      description={groupDescription(t, "email") ?? undefined}
    >
      <AdminSection title={t("email.senderSection")}>
        <SettingsGroupForm
          settings={sender}
          locales={localeOptions}
          menus={menuOptions}
          labels={formLabels}
        />
      </AdminSection>

      {canManageTransport ? (
        <EmailTransportForm
          transport={transport}
          labels={{
            section: t("email.deliverySection"),
            sectionDescription: t("email.deliveryDescription"),
            driver: t("email.driver"),
            driverHint: t("email.driverHint"),
            driverSmtp: t("email.driverSmtp"),
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
          }}
        />
      )}

      <AdminSection title={t("email.placementsSection")}>
        <SettingsGroupForm
          settings={placements}
          locales={localeOptions}
          menus={menuOptions}
          labels={formLabels}
        />
      </AdminSection>
    </SettingsScreen>
  );
}

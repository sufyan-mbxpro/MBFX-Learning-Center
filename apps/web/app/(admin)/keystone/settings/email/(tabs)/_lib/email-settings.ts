// What the Sender and Newsletter tabs share (changes-51): both render a slice
// of the `email` registry group through `SettingsGroupForm`, and the form's
// options and forty labels are the same for both. One copy, not two.
import { getTranslations } from "next-intl/server";
import { loadAdminMenus } from "@repo/core";
import { getActiveLocales } from "@repo/i18n";
import type { Subject } from "@repo/rbac";
import { loadSettingsIndex } from "../../../_components/settings-shared.ts";

/** Which slice of the `email` group a tab edits. */
export type EmailSettingsSlice = "sender" | "newsletter";

export async function loadEmailSettingsForm(subject: Subject, slice: EmailSettingsSlice) {
  const t = await getTranslations("admin");
  const [{ settings }, locales, menus] = await Promise.all([
    loadSettingsIndex(subject, t),
    getActiveLocales(),
    loadAdminMenus(),
  ]);

  // Two tabs out of one registry group: a sender address and "show the signup
  // form in the footer" are different questions, and one Save over both reads
  // as a single decision (ADR-044 #8).
  const prefix = slice === "sender" ? "email." : "newsletter.";
  const group = settings
    .filter((s) => s.groupName === "email" && s.key.startsWith(prefix))
    // ADR-044 #5's order of preference, as `settings/[group]` applies it.
    .map((s) =>
      t.has(`settingLabels.${s.key}`) ? { ...s, label: t(`settingLabels.${s.key}`) } : s,
    )
    .map((s) =>
      t.has(`settingDescriptions.${s.key}`)
        ? { ...s, description: t(`settingDescriptions.${s.key}`) }
        : s,
    );

  return {
    settings: group,
    locales: locales.map((l) => ({ code: l.code, name: l.name, nativeName: l.nativeName })),
    menus: menus.map((m) => ({ value: m.key, label: m.name })),
    labels: {
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
    },
  };
}

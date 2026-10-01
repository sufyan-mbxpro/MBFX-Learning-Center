import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { can, requirePermission } from "@repo/rbac";
import { listReviewPlatforms, loadAdminMenus, loadBrandAssets } from "@repo/core";
import { REVIEW_PLATFORM_KEYS, type ReviewPlatformKey } from "@repo/contracts";
import { getActiveLocales } from "@repo/i18n";
import { loadCaptchaSettings } from "@repo/auth";
import { AdminSection } from "../../_components/admin-page.tsx";
import { SettingsScreen } from "../_components/settings-screen.tsx";
import {
  SETTINGS_GROUP_TABS,
  groupDescription,
  groupLabel,
  loadSettingsIndex,
} from "../_components/settings-shared.ts";
import { BrandAssetsForm } from "../../_components/brand-assets-form.tsx";
import { SettingsGroupForm, type SettingsTab } from "../settings-group-form.tsx";
import { CaptchaSettingsForm } from "../captcha-settings-form.tsx";
import { ReviewPlatformsForm } from "../review-platforms-form.tsx";

// One settings category on its own page (changes-01, image-4): sub-sidebar
// for switching categories, type-driven fields for this group, ONE Save for
// the whole section (changes-02). Unknown group → 404, not an empty page.
export default async function SettingsGroupPage({
  params,
}: PageProps<"/keystone/settings/[group]">) {
  const subject = await requirePermission("settings.view");
  const { group } = await params;
  const t = await getTranslations("admin");
  const [{ settings, groups, navEntries }, locales, menus] = await Promise.all([
    loadSettingsIndex(subject, t),
    getActiveLocales(),
    // Resolves footer.menuColumns' menu picker (Phase 9c) — a Select of
    // real menus instead of a free-text key an admin can typo.
    loadAdminMenus(),
  ]);

  if (!groups.includes(group)) notFound();
  // A setting's label is its stored row's, unless the catalog names it
  // (ADR-044 #5's order of preference: a catalog string first). changes-46:
  // the media caps are seeded "Max image upload size (bytes)", which the MB
  // dropdown made untrue — the words move here, the seeded row is untouched.
  const groupSettings = settings
    .filter((s) => s.groupName === group)
    .map((s) =>
      t.has(`settingLabels.${s.key}`) ? { ...s, label: t(`settingLabels.${s.key}`) } : s,
    )
    // The same two-step for the line under a field (changes-49): a setting
    // whose EFFECT is not obvious from its name — which inbox the support
    // form writes to — says so from the catalog.
    .map((s) =>
      t.has(`settingDescriptions.${s.key}`)
        ? { ...s, description: t(`settingDescriptions.${s.key}`) }
        : s,
    );
  const description = groupDescription(t, group);

  const uploadLabels = {
    upload: t("uploadImage"),
    replace: t("replaceImage"),
    remove: t("removeImage"),
    uploading: t("uploading"),
    hint: t("uploadHint"),
    cancel: t("cancel"),
    confirmRemoveTitle: t("confirmRemoveImageTitle"),
    confirmRemoveBody: t("confirmRemoveImageBody"),
  };

  // changes-50: General is tabbed, and its Branding tab is the logos and
  // favicon that were the theme editor's. Their actions gate on
  // `theme.update`, so a subject without it gets no Branding tab rather than
  // uploads that would be refused.
  // ADR-156: the reCAPTCHA tab saves under `settings.update`, so a subject
  // who can only view settings gets no tab rather than a form that is refused.
  const tabDefs = (SETTINGS_GROUP_TABS[group] ?? []).filter(
    (tab) =>
      (tab.id !== "branding" || can(subject, "theme.update")) &&
      (tab.id !== "captcha" || can(subject, "settings.update")) &&
      // ADR-169: saved under `settings.update`, so a viewer gets no tab.
      (tab.id !== "reviews" || can(subject, "settings.update")),
  );
  const [brandAssets, captchaSettings, reviewPlatforms] = await Promise.all([
    tabDefs.some((tab) => tab.id === "branding") ? loadBrandAssets() : null,
    tabDefs.some((tab) => tab.id === "captcha") ? loadCaptchaSettings() : null,
    tabDefs.some((tab) => tab.id === "reviews") ? listReviewPlatforms() : null,
  ]);
  // One label per platform, resolved here so the client form holds no catalog.
  const perPlatform = (make: (platform: ReviewPlatformKey) => string) =>
    Object.fromEntries(REVIEW_PLATFORM_KEYS.map((p) => [p, make(p)])) as Record<
      ReviewPlatformKey,
      string
    >;
  const tabs: SettingsTab[] | undefined =
    tabDefs.length > 0
      ? tabDefs.map((tab) => ({
          id: tab.id,
          label: t(`settingsTabs.${tab.id}`),
          ...(tab.id === "branding" && brandAssets
            ? {
                content: (
                  <BrandAssetsForm
                    initial={{
                      logo_light: brandAssets.logo_light?.url ?? null,
                      logo_dark: brandAssets.logo_dark?.url ?? null,
                      favicon: brandAssets.favicon?.url ?? null,
                    }}
                    labels={{
                      logoLight: t("logoLight"),
                      logoDark: t("logoDark"),
                      favicon: t("favicon"),
                      saved: t("saved"),
                      upload: uploadLabels,
                    }}
                  />
                ),
              }
            : tab.id === "captcha" && captchaSettings
              ? {
                  content: (
                    <CaptchaSettingsForm
                      settings={captchaSettings}
                      labels={{
                        section: t("captcha.section"),
                        sectionDescription: t("captcha.sectionDescription"),
                        enabled: t("captcha.enabled"),
                        enabledHint: t("captcha.enabledHint"),
                        mode: t("captcha.mode"),
                        modeHint: t("captcha.modeHint"),
                        modes: {
                          SCORE: t("captcha.modes.SCORE"),
                          CHECKBOX: t("captcha.modes.CHECKBOX"),
                        },
                        checkboxProof: t("captcha.checkboxProof"),
                        siteKey: t("captcha.siteKey"),
                        siteKeyHint: t("captcha.siteKeyHint"),
                        secretKey: t("captcha.secretKey"),
                        secretKeyHint: t("captcha.secretKeyHint"),
                        secretKeySaved: t("captcha.secretKeySaved"),
                        minScore: t("captcha.minScore"),
                        minScoreHint: t("captcha.minScoreHint"),
                        showSecret: t("showPassword"),
                        hideSecret: t("hidePassword"),
                        save: t("save"),
                        saved: t("saved"),
                        lastVerified: t("captcha.lastVerified"),
                        never: t("captcha.never"),
                        sealKeyMissingTitle: t("captcha.sealKeyMissingTitle"),
                        sealKeyMissingBody: t("captcha.sealKeyMissingBody"),
                        forcedOffTitle: t("captcha.forcedOffTitle"),
                        forcedOffBody: t("captcha.forcedOffBody"),
                        refusals: {
                          sealKeyMissing: t("captcha.refusals.sealKeyMissing"),
                          secretRequired: t("captcha.refusals.secretRequired"),
                          checkFailed: t("captcha.refusals.checkFailed"),
                          tokenUnavailable: t("captcha.refusals.tokenUnavailable"),
                          unchecked: t("captcha.refusals.unchecked"),
                        },
                      }}
                    />
                  ),
                }
              : tab.id === "reviews" && reviewPlatforms
                ? {
                    content: (
                      <ReviewPlatformsForm
                        initial={reviewPlatforms.map(
                          ({ platform, isEnabled, identifier, customUrl }) => ({
                            platform,
                            isEnabled,
                            identifier,
                            customUrl,
                          }),
                        )}
                        labels={{
                          section: t("reviewPlatforms.section"),
                          sectionDescription: t("reviewPlatforms.sectionDescription"),
                          platforms: perPlatform((p) => t(`reviewPlatforms.platforms.${p}`)),
                          enabled: perPlatform((p) =>
                            t("reviewPlatforms.enabled", {
                              platform: t(`reviewPlatforms.platforms.${p}`),
                            }),
                          ),
                          enabledHint: t("reviewPlatforms.enabledHint"),
                          identifier: perPlatform((p) => t(`reviewPlatforms.identifier.${p}`)),
                          identifierHint: perPlatform((p) =>
                            t(`reviewPlatforms.identifierHint.${p}`),
                          ),
                          customUrl: t("reviewPlatforms.customUrl"),
                          customUrlHint: t("reviewPlatforms.customUrlHint"),
                          preview: t("reviewPlatforms.preview"),
                          noLink: t("reviewPlatforms.noLink"),
                          test: t("reviewPlatforms.test"),
                          moveUp: perPlatform((p) =>
                            t("reviewPlatforms.moveUp", {
                              platform: t(`reviewPlatforms.platforms.${p}`),
                            }),
                          ),
                          moveDown: perPlatform((p) =>
                            t("reviewPlatforms.moveDown", {
                              platform: t(`reviewPlatforms.platforms.${p}`),
                            }),
                          ),
                          status: {
                            on: t("reviewPlatforms.status.on"),
                            off: t("reviewPlatforms.status.off"),
                            needsLink: t("reviewPlatforms.status.needsLink"),
                          },
                          save: t("save"),
                          saved: t("saved"),
                        }}
                      />
                    ),
                  }
                : { keys: tab.keys }),
        }))
      : undefined;

  return (
    <SettingsScreen
      navHeading={t("settingsCategories")}
      navEntries={navEntries}
      title={groupLabel(t, group)}
      description={description ?? undefined}
    >
      <AdminSection>
        <SettingsGroupForm
          settings={groupSettings}
          locales={locales.map((l) => ({
            code: l.code,
            name: l.name,
            nativeName: l.nativeName,
          }))}
          menus={menus.map((m) => ({ value: m.key, label: m.name }))}
          {...(tabs ? { tabs } : {})}
          labels={{
            save: t("save"),
            saved: t("saved"),
            publicBadge: t("publicBadge"),
            privateBadge: t("privateBadge"),
            selectPlaceholder: t("selectPlaceholder"),
            managedElsewhere: t("settingManagedElsewhere"),
            upload: uploadLabels,
            fields: {
              addRow: t("fieldAddRow"),
              removeRow: t("fieldRemoveRow"),
              emptyList: t("fieldEmptyList"),
              selectPlaceholder: t("selectPlaceholder"),
              cancel: t("cancel"),
              confirmRemoveTitle: t("confirmRemoveRowTitle"),
              confirmRemoveBody: t("confirmRemoveRowBody"),
              // Every labelKey SETTING_FIELDS references, resolved here
              // so the generic editors never touch a catalog themselves.
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
          }}
        />
      </AdminSection>
    </SettingsScreen>
  );
}

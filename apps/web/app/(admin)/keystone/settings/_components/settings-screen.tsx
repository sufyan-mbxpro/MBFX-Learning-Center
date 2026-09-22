// The layout every settings-shaped screen shares (changes-08 #4).
//
// Before this, a settings page wrapped its sub-nav AND its cards in
// `AdminPage`, so the heading sat above both columns — reading as a label
// for the category list on the left rather than for the fields on the
// right. The heading now lives INSIDE the content column, directly above
// the cards it describes; the sub-nav is a sibling that carries only its
// own "Settings" label.
//
// Used by /keystone/settings/[group], /keystone/settings/social
// and /keystone/theme — one component, so the four stay identical instead of
// drifting into four arrangements of the same two columns.
import { AdminPageHeading } from "../../_components/admin-page.tsx";
import { HeaderActionsProvider } from "../../_components/header-actions.tsx";
import { SubNav } from "../../_components/sub-nav.tsx";
import { SettingsNav, type SettingsNavEntry, type SettingsSectionTab } from "./settings-nav.tsx";

export function SettingsScreen({
  navHeading,
  navEntries,
  title,
  description,
  actions,
  tabs,
  children,
}: {
  navHeading: string;
  navEntries: SettingsNavEntry[];
  title: string;
  description?: string;
  actions?: React.ReactNode;
  /**
   * Route tabs under the heading (changes-51: Email, AI). Rendered by a
   * section LAYOUT, which survives a tab click, so the heading and the strip
   * do not unmount between tabs (ADR-106 #2). A strip of one says nothing and
   * is not drawn.
   */
  tabs?: SettingsSectionTab[];
  children: React.ReactNode;
}) {
  // ADR-140 §3: a slot on the title row, so a client manager below (the
  // social links table's "Add") can put its button there with
  // `<HeaderActions>` while keeping the dialog it opens.
  return (
    <HeaderActionsProvider>
      <div className="flex w-full flex-col gap-6 md:flex-row">
        <SettingsNav heading={navHeading} entries={navEntries} />
        <div className="flex min-w-0 flex-1 flex-col gap-6">
          <AdminPageHeading title={title} description={description} actions={actions} actionsSlot />
          {tabs && tabs.length > 1 && <SubNav items={tabs} aria-label={title} />}
          {children}
        </div>
      </div>
    </HeaderActionsProvider>
  );
}

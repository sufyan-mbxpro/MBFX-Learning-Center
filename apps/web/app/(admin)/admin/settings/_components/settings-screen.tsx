// The layout every settings-shaped screen shares (changes-08 #4).
//
// Before this, a settings page wrapped its sub-nav AND its cards in
// `AdminPage`, so the heading sat above both columns — reading as a label
// for the category list on the left rather than for the fields on the
// right. The heading now lives INSIDE the content column, directly above
// the cards it describes; the sub-nav is a sibling that carries only its
// own "Settings" label.
//
// Used by /admin/settings/[group], /admin/settings/social, /admin/features
// and /admin/theme — one component, so the four stay identical instead of
// drifting into four arrangements of the same two columns.
import { AdminPageHeading } from "../../_components/admin-page.tsx";
import { SettingsNav, type SettingsNavEntry } from "./settings-nav.tsx";

export function SettingsScreen({
  navHeading,
  navEntries,
  title,
  description,
  actions,
  children,
}: {
  navHeading: string;
  navEntries: SettingsNavEntry[];
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex w-full flex-col gap-6 md:flex-row">
      <SettingsNav heading={navHeading} entries={navEntries} />
      <div className="flex min-w-0 flex-1 flex-col gap-6">
        <AdminPageHeading title={title} description={description} actions={actions} />
        {children}
      </div>
    </div>
  );
}

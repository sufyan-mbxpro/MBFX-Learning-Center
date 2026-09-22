// Display strings for the permission cards (ADR-083).
//
// The registry in `@repo/db` holds the group NAMES and their order; it holds
// no strings, because packages carry no catalogs (code-style.md #2). This is
// the two-step ADR-044 #5 asks for — a catalog string, then `humanizeKey()` —
// and it is the same pair `settings/_components/settings-shared.ts` uses for
// settings groups. `t.has` matters: a group seeded without a catalog entry
// must degrade to "Video Topics", never to `video_topics`.
import { humanizeKey } from "@repo/utils";
import type { PermissionGroup } from "@repo/core";
import type { PermissionGroupView } from "../roles/[key]/role-permissions.tsx";

type Translate = (key: string, values?: Record<string, string | number | Date>) => string;
type TranslateHas = Translate & { has: (key: string) => boolean };

export function permissionGroupLabel(t: TranslateHas, groupName: string): string {
  return t.has(`permissionGroups.${groupName}`)
    ? t(`permissionGroups.${groupName}`)
    : humanizeKey(groupName);
}

export function permissionGroupDescription(t: TranslateHas, groupName: string): string | null {
  return t.has(`permissionGroupDesc.${groupName}`) ? t(`permissionGroupDesc.${groupName}`) : null;
}

/** `loadRoleMatrix()`'s groups, resolved for the screen. Order is preserved. */
export function permissionGroupViews(
  t: TranslateHas,
  groups: PermissionGroup[],
): PermissionGroupView[] {
  return groups.map((group) => ({
    ...group,
    label: permissionGroupLabel(t, group.groupName),
    description: permissionGroupDescription(t, group.groupName),
  }));
}

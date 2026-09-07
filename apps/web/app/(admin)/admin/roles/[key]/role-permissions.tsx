"use client";

// Grouped permission editor (changes-01, image-2): "grant all" master
// toggle, per-group select-all, individual checkboxes, capability search —
// every change AUTOSAVES optimistically and rolls back on failure (the
// MatrixCell pattern, generalized). System roles are editable too (ADR-016,
// changes-02) — only roles at/above the actor's level ceiling are read-only.
import * as React from "react";
import { useTransition } from "react";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { Checkbox } from "@repo/ui/components/checkbox";
import { humanizeKey } from "@repo/utils";
import { Input } from "@repo/ui/components/input";
import { setRolePermissionAction, setRolePermissionsAction } from "../../_actions/user-actions.ts";

export interface PermissionGroupView {
  groupName: string;
  permissions: { key: string; label: string }[];
}

export function RolePermissions({
  roleKey,
  groups,
  grantedKeys,
  readOnly,
  labels,
}: {
  roleKey: string;
  groups: PermissionGroupView[];
  grantedKeys: string[];
  readOnly: boolean;
  labels: {
    grantAll: string;
    selectAll: string;
    search: string;
    enabledOf: string; // interpolated client-side as `${n} ${enabledOf} ${total}`
  };
}) {
  const [granted, setGranted] = React.useState<Set<string>>(new Set(grantedKeys));
  const [query, setQuery] = React.useState("");
  const [, startTransition] = useTransition();

  const allKeys = React.useMemo(
    () => groups.flatMap((g) => g.permissions.map((p) => p.key)),
    [groups],
  );

  const apply = (keys: string[], value: boolean) => {
    // Optimistic write, rollback on failure.
    const previous = new Set(granted);
    setGranted((current) => {
      const next = new Set(current);
      for (const key of keys) {
        if (value) next.add(key);
        else next.delete(key);
      }
      return next;
    });
    startTransition(async () => {
      try {
        if (keys.length === 1) {
          await setRolePermissionAction(roleKey, keys[0]!, value);
        } else {
          await setRolePermissionsAction({ roleKey, permissionKeys: keys, granted: value });
        }
      } catch (error) {
        setGranted(previous);
        toast.error(error instanceof Error ? error.message : String(error));
      }
    });
  };

  const q = query.trim().toLowerCase();
  const visibleGroups = groups
    .map((group) => ({
      ...group,
      permissions: group.permissions.filter(
        (p) => !q || p.key.toLowerCase().includes(q) || p.label.toLowerCase().includes(q),
      ),
    }))
    .filter((group) => group.permissions.length > 0);

  const allGranted = allKeys.length > 0 && allKeys.every((key) => granted.has(key));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-4">
        <div className="flex items-center justify-between gap-3">
          <label className="flex items-center gap-2.5 text-sm font-medium">
            {!readOnly && (
              <Checkbox
                checked={allGranted}
                indeterminate={!allGranted && granted.size > 0}
                onCheckedChange={(next) => apply(allKeys, next === true)}
                aria-label={labels.grantAll}
              />
            )}
            {labels.grantAll}
          </label>
          <span className="text-sm text-muted-foreground">
            {granted.size} {labels.enabledOf} {allKeys.length}
          </span>
        </div>
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={labels.search}
          aria-label={labels.search}
        />
      </div>

      {visibleGroups.map((group) => {
        const groupKeys = group.permissions.map((p) => p.key);
        const groupGranted = groupKeys.filter((key) => granted.has(key)).length;
        const groupAll = groupGranted === groupKeys.length;
        return (
          <section key={group.groupName} className="rounded-lg border">
            <header className="flex items-center justify-between gap-3 border-b bg-muted/20 px-4 py-2.5">
              <h3 className="text-sm font-semibold capitalize">
                {group.groupName}
                <span className="ms-2 font-normal text-muted-foreground">
                  {groupGranted} {labels.enabledOf} {groupKeys.length}
                </span>
              </h3>
              {!readOnly && (
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  {labels.selectAll}
                  <Checkbox
                    checked={groupAll}
                    indeterminate={!groupAll && groupGranted > 0}
                    onCheckedChange={(next) => apply(groupKeys, next === true)}
                    aria-label={`${labels.selectAll}: ${group.groupName}`}
                  />
                </label>
              )}
            </header>
            <ul className="grid gap-x-6 sm:grid-cols-2">
              {group.permissions.map((permission) => (
                <li
                  key={permission.key}
                  className="flex items-center gap-2.5 border-b px-4 py-2 last:border-b-0 sm:nth-last-2:border-b-0"
                >
                  {readOnly ? (
                    granted.has(permission.key) ? (
                      <Check aria-hidden className="size-4 shrink-0 text-success-interactive" />
                    ) : (
                      <span aria-hidden className="inline-block size-4 shrink-0" />
                    )
                  ) : (
                    <Checkbox
                      checked={granted.has(permission.key)}
                      onCheckedChange={(next) => apply([permission.key], next === true)}
                      aria-label={permission.label}
                    />
                  )}
                  <div className="flex min-w-0 flex-col py-0.5">
                    <span className="truncate text-sm">{permission.label}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {humanizeKey(permission.key)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

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
import { Field, FieldContent, FieldDescription, FieldLabel } from "@repo/ui/components/field";
import { humanizeKey } from "@repo/utils";
import { Input } from "@repo/ui/components/input";
import { setRolePermissionAction, setRolePermissionsAction } from "../../_actions/user-actions.ts";

export interface PermissionGroupView {
  groupName: string;
  /** Resolved by the page: a catalog string, else `humanizeKey()` (ADR-044 #5). */
  label: string;
  /** One line naming the admin screens this card governs. Optional. */
  description?: string | null;
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
        (p) =>
          !q ||
          // The GROUP label matches too: typing "courses" or "news" is how
          // someone looks for a card, now that the cards are page-shaped.
          group.label.toLowerCase().includes(q) ||
          p.key.toLowerCase().includes(q) ||
          p.label.toLowerCase().includes(q),
      ),
    }))
    .filter((group) => group.permissions.length > 0);

  const allGranted = allKeys.length > 0 && allKeys.every((key) => granted.has(key));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-4">
        <div className="flex items-center justify-between gap-3">
          {readOnly ? (
            <span className="text-sm font-medium">{labels.grantAll}</span>
          ) : (
            <Field orientation="horizontal" className="w-auto">
              <Checkbox
                checked={allGranted}
                indeterminate={!allGranted && granted.size > 0}
                onCheckedChange={(next) => apply(allKeys, next === true)}
              />
              <FieldLabel>{labels.grantAll}</FieldLabel>
            </Field>
          )}
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
              {/* The `capitalize` class is gone (ADR-083). It was papering over
                  a raw group id — and it only ever fixed the first letter, which
                  is why `seo` rendered as "Seo". The label is a catalog string
                  now, so nothing may re-case it: `text-transform: capitalize`
                  would break "News & analysis" the moment a label has a word the
                  catalog deliberately left lowercase. */}
              <div className="flex min-w-0 flex-col">
                {/* The count is a SIBLING of the heading, not inside it. Inside,
                    the accessible name concatenated to "Users & roles0of9" —
                    `ms-2` is a margin, and a margin is not a space. A heading
                    also should not name a number that changes as you click. */}
                <div className="flex items-baseline gap-2">
                  <h3 className="text-sm font-semibold">{group.label}</h3>
                  <span className="text-sm text-muted-foreground">
                    {groupGranted} {labels.enabledOf} {groupKeys.length}
                  </span>
                </div>
                {group.description ? (
                  <p className="text-xs text-muted-foreground">{group.description}</p>
                ) : null}
              </div>
              {!readOnly && (
                <Field orientation="horizontal" className="w-auto">
                  <FieldLabel className="font-normal text-muted-foreground">
                    {labels.selectAll}
                  </FieldLabel>
                  {/* The aria-label names the GROUP too: every section has a
                      "Select all", and a screen reader lists them together. */}
                  <Checkbox
                    checked={groupAll}
                    indeterminate={!groupAll && groupGranted > 0}
                    onCheckedChange={(next) => apply(groupKeys, next === true)}
                    aria-label={`${labels.selectAll}: ${group.label}`}
                  />
                </Field>
              )}
            </header>
            <ul className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
              {group.permissions.map((permission) => (
                <li
                  key={permission.key}
                  className="flex items-center gap-2.5 border-b px-4 py-2 last:border-b-0 sm:nth-last-2:border-b-0"
                >
                  {readOnly ? (
                    <>
                      {granted.has(permission.key) ? (
                        <Check aria-hidden className="size-4 shrink-0 text-success-interactive" />
                      ) : (
                        <span aria-hidden className="inline-block size-4 shrink-0" />
                      )}
                      <div className="flex min-w-0 flex-col py-0.5">
                        <span className="truncate text-sm">{permission.label}</span>
                        <span className="truncate text-xs text-muted-foreground">
                          {humanizeKey(permission.key)}
                        </span>
                      </div>
                    </>
                  ) : (
                    <Field orientation="horizontal" className="min-w-0">
                      <Checkbox
                        checked={granted.has(permission.key)}
                        onCheckedChange={(next) => apply([permission.key], next === true)}
                      />
                      <FieldContent className="min-w-0 py-0.5">
                        <FieldLabel className="w-full min-w-0 font-normal">
                          <span className="truncate">{permission.label}</span>
                        </FieldLabel>
                        <FieldDescription className="truncate text-xs">
                          {humanizeKey(permission.key)}
                        </FieldDescription>
                      </FieldContent>
                    </Field>
                  )}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

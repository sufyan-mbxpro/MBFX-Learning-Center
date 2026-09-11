"use client";

// One settings section = ONE form = ONE Save (changes-02). Fields render
// by registry type (SKILL.md: STRING/TEXT/NUMBER/BOOLEAN/JSON/IMAGE/COLOR/
// SELECT) plus the widget hints in @repo/contracts (timezone / locale /
// select dropdowns). Only changed keys are submitted; the server validates
// every entry before writing any, so a bad field saves nothing.
import * as React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import {
  SETTING_FIELDS,
  SETTING_SELECT_OPTIONS,
  SETTING_WIDGETS,
  type SettingKey,
} from "@repo/contracts";
import { humanizeKey } from "@repo/utils";
import { cn } from "@repo/ui/lib/utils";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Checkbox } from "@repo/ui/components/checkbox";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { Textarea } from "@repo/ui/components/textarea";
import { updateSettingsAction } from "../_actions/admin-actions.ts";
import { ImageUploadField, type ImageUploadLabels } from "../_components/image-upload-field.tsx";
import { AdminCombobox } from "../_components/combobox.tsx";
import { useServerAction } from "../_hooks/use-server-action.ts";
import {
  ListField,
  ObjectField,
  type FieldOptionSources,
  type SettingFieldsLabels,
} from "./setting-fields.tsx";

export interface SettingFieldData {
  key: string;
  label: string;
  description: string | null;
  type: string;
  value: unknown;
  isPublic: boolean;
}

export interface SettingsGroupLabels {
  save: string;
  saved: string;
  publicBadge: string;
  privateBadge: string;
  selectPlaceholder: string;
  upload: ImageUploadLabels;
  /** Structured-editor labels (Phase 9c). */
  fields: SettingFieldsLabels;
  /** "Managed on its own screen" link text, for keys with a dedicated UI. */
  managedElsewhere: string;
}

/**
 * Settings that have a DEDICATED admin screen. Rendering a raw JSON
 * textarea for them here as well would mean two editors for one value, the
 * worse one always visible — so this group form points at the good one
 * instead (changes-03-plan.md §12.5).
 */
const MANAGED_ELSEWHERE: Record<string, string> = {
  "home.sections": "/admin/homepage",
};

export interface LocaleOption {
  code: string;
  name: string;
  nativeName: string;
}

function initialText(setting: SettingFieldData): string {
  if (setting.type === "JSON") return JSON.stringify(setting.value, null, 2);
  return String(setting.value ?? "");
}

function timezoneOptions(current: string): string[] {
  let zones: string[] = [];
  try {
    zones = Intl.supportedValuesOf("timeZone");
  } catch {
    zones = ["UTC"];
  }
  if (!zones.includes("UTC")) zones = ["UTC", ...zones];
  if (current && !zones.includes(current)) zones = [current, ...zones];
  return zones;
}

export function SettingsGroupForm({
  settings,
  locales,
  menus,
  labels,
}: {
  settings: SettingFieldData[];
  locales: LocaleOption[];
  /** Resolves SETTING_FIELDS' `optionsFrom: "menus"` choices. */
  menus: { value: string; label: string }[];
  labels: SettingsGroupLabels;
}) {
  const { run, pending } = useServerAction();
  const initial = React.useMemo(
    () => Object.fromEntries(settings.map((s) => [s.key, initialText(s)])),
    [settings],
  );
  const [text, setText] = React.useState<Record<string, string>>(initial);
  const [booleans, setBooleans] = React.useState<Record<string, boolean>>(() =>
    Object.fromEntries(settings.map((s) => [s.key, Boolean(s.value)])),
  );
  const [jsonErrors, setJsonErrors] = React.useState<Record<string, boolean>>({});
  // Keys with SETTING_FIELDS descriptors are edited as real VALUES, not as
  // text that has to survive a JSON.parse round trip.
  const structuredInitial = React.useMemo(
    () =>
      Object.fromEntries(
        settings.filter((s) => SETTING_FIELDS[s.key as SettingKey]).map((s) => [s.key, s.value]),
      ),
    [settings],
  );
  const [structured, setStructured] = React.useState<Record<string, unknown>>(structuredInitial);
  const sources: FieldOptionSources = React.useMemo(() => ({ menus }), [menus]);

  const changedKeys = settings
    .filter((s) => {
      if (MANAGED_ELSEWHERE[s.key]) return false;
      if (SETTING_FIELDS[s.key as SettingKey]) {
        return JSON.stringify(structured[s.key]) !== JSON.stringify(structuredInitial[s.key]);
      }
      return s.type === "BOOLEAN"
        ? booleans[s.key] !== Boolean(s.value)
        : text[s.key] !== initial[s.key];
    })
    .map((s) => s.key);
  const dirty = changedKeys.length > 0;

  const submit = () => {
    const entries: { key: string; value: unknown }[] = [];
    const nextJsonErrors: Record<string, boolean> = {};
    for (const setting of settings) {
      if (!changedKeys.includes(setting.key)) continue;
      const raw = text[setting.key] ?? "";
      let value: unknown = raw;
      if (SETTING_FIELDS[setting.key as SettingKey]) value = structured[setting.key];
      else if (setting.type === "BOOLEAN") value = booleans[setting.key] ?? false;
      else if (setting.type === "NUMBER") value = Number(raw);
      else if (setting.type === "JSON") {
        try {
          value = JSON.parse(raw);
        } catch {
          nextJsonErrors[setting.key] = true;
        }
      }
      entries.push({ key: setting.key, value });
    }
    setJsonErrors(nextJsonErrors);
    if (Object.keys(nextJsonErrors).length > 0 || entries.length === 0) return;
    run(() => updateSettingsAction(entries), { successMessage: labels.saved });
  };

  const setValue = (key: string, value: string) =>
    setText((current) => ({ ...current, [key]: value }));

  // ADR-040: the form is a responsive 2-column grid above xl, so a settings
  // group fills the (now full-width) page instead of leaving the inline-end
  // half empty. Which fields take the whole row is derived from the
  // registry TYPE, never hand-tagged per key — that way a settings row
  // added later lands in the right column count with no edit here.
  const spansFullRow = (setting: SettingFieldData) =>
    setting.type === "TEXT" ||
    setting.type === "JSON" ||
    setting.type === "IMAGE" ||
    // Structured list/object editors are tables of sub-fields, not one
    // control — they never fit a half-row.
    Boolean(SETTING_FIELDS[setting.key as SettingKey]);

  const renderControl = (setting: SettingFieldData) => {
    const id = `setting-${setting.key}`;
    const value = text[setting.key] ?? "";
    const widget = SETTING_WIDGETS[setting.key as SettingKey];

    const managedHref = MANAGED_ELSEWHERE[setting.key];
    if (managedHref) {
      return (
        <Link
          href={managedHref}
          className="inline-flex w-fit items-center gap-1.5 text-sm text-primary-interactive hover:underline"
        >
          {labels.managedElsewhere}
          <ArrowRight aria-hidden className="size-3.5 rtl:rotate-180" />
        </Link>
      );
    }

    const fieldsDef = SETTING_FIELDS[setting.key as SettingKey];
    if (fieldsDef) {
      const onChange = (next: unknown) =>
        setStructured((current) => ({ ...current, [setting.key]: next }));
      return fieldsDef.shape === "list" ? (
        <ListField
          settingKey={setting.key}
          def={fieldsDef}
          value={structured[setting.key]}
          sources={sources}
          labels={labels.fields}
          onChange={onChange}
        />
      ) : (
        <ObjectField
          settingKey={setting.key}
          def={fieldsDef}
          value={structured[setting.key]}
          sources={sources}
          labels={labels.fields}
          onChange={onChange}
        />
      );
    }

    if (setting.type === "BOOLEAN") {
      return (
        <Checkbox
          id={id}
          checked={booleans[setting.key] ?? false}
          onCheckedChange={(next) =>
            setBooleans((current) => ({ ...current, [setting.key]: next === true }))
          }
        />
      );
    }
    if (setting.type === "IMAGE") {
      return (
        <ImageUploadField
          id={id}
          label=""
          value={value}
          purpose="setting"
          category="general"
          sourceType="SETTING"
          labels={labels.upload}
          onChange={(next) => setValue(setting.key, next?.url ?? "")}
        />
      );
    }
    if (setting.type === "TEXT" || setting.type === "JSON") {
      return (
        <Textarea
          id={id}
          value={value}
          aria-invalid={jsonErrors[setting.key] ? true : undefined}
          onChange={(e) => setValue(setting.key, e.target.value)}
          rows={setting.type === "JSON" ? 6 : 3}
          className={setting.type === "JSON" ? "font-mono" : undefined}
        />
      );
    }

    const selectOptions: { value: string; label: string }[] | null =
      widget === "timezone"
        ? timezoneOptions(value).map((z) => ({ value: z, label: z.replaceAll("_", " ") }))
        : widget === "locale"
          ? locales.map((l) => ({ value: l.code, label: `${l.name} (${l.nativeName})` }))
          : widget === "select" || setting.type === "SELECT"
            ? (SETTING_SELECT_OPTIONS[setting.key as SettingKey] ?? []).map((o) => ({
                value: o,
                label: o,
              }))
            : null;

    if (selectOptions && selectOptions.length > 0) {
      const current = selectOptions.find((o) => o.value === value);
      return (
        <AdminCombobox
          id={id}
          value={value}
          onValueChange={(v) => setValue(setting.key, v)}
          placeholder={current?.label ?? value ?? labels.selectPlaceholder}
          options={selectOptions.map((option) => ({
            value: option.value,
            label: option.label,
          }))}
        />
      );
    }

    return (
      <Input
        id={id}
        type={setting.type === "NUMBER" ? "number" : setting.type === "COLOR" ? "color" : "text"}
        value={value}
        onChange={(e) => setValue(setting.key, e.target.value)}
        className="w-full"
      />
    );
  };

  return (
    <form
      className="grid grid-cols-1 items-start gap-x-8 gap-y-5 xl:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      {settings.map((setting) => (
        <div
          key={setting.key}
          className={cn(
            "flex flex-col gap-1.5 border-b pb-4",
            spansFullRow(setting) && "xl:col-span-2",
          )}
        >
          <div className="flex flex-wrap items-center gap-2">
            <Label htmlFor={`setting-${setting.key}`}>{setting.label}</Label>
            <Badge variant="secondary">
              {setting.isPublic ? labels.publicBadge : labels.privateBadge}
            </Badge>
            <span className="text-xs text-muted-foreground">{humanizeKey(setting.key)}</span>
          </div>
          {setting.description && (
            <p className="text-sm text-muted-foreground">{setting.description}</p>
          )}
          {renderControl(setting)}
        </div>
      ))}
      {/* changes-08 #3: Save at the inline-END of the section. The
          dirty-field summary reads BEFORE it (start-aligned) so the button
          keeps the corner every other confirming action in the admin uses.
          #2: the summary names the changed fields in words, not raw
          setting keys. */}
      <div className="flex flex-wrap items-center justify-end gap-3 border-t pt-4 xl:col-span-2">
        {dirty && (
          <span className="me-auto text-xs text-muted-foreground">
            {changedKeys.length} · {changedKeys.map((key) => humanizeKey(key)).join(", ")}
          </span>
        )}
        <Button type="submit" disabled={pending || !dirty}>
          {labels.save}
        </Button>
      </div>
    </form>
  );
}

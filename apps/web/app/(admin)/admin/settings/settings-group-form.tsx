"use client";

// One settings section = ONE form = ONE Save (changes-02). Fields render
// by registry type (SKILL.md: STRING/TEXT/NUMBER/BOOLEAN/JSON/IMAGE/COLOR/
// SELECT) plus the widget hints in @repo/contracts (timezone / locale /
// select dropdowns). Only changed keys are submitted; the server validates
// every entry before writing any, so a bad field saves nothing.
//
// Inline validation (ADR-077) uses the SAME per-key schemas the settings
// service parses with (`SETTINGS_SCHEMAS`), over exactly the changed keys the
// action will receive — so an unchanged, already-stored value is not judged
// here either, just as it is not judged there.
import * as React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { z } from "zod";
import {
  SETTINGS_SCHEMAS,
  SETTING_FIELDS,
  SETTING_SELECT_OPTIONS,
  SETTING_WIDGETS,
  isKnownSettingKey,
  type SettingFieldDef,
  type SettingKey,
} from "@repo/contracts";
import { humanizeKey } from "@repo/utils";
import { cn } from "@repo/ui/lib/utils";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Checkbox } from "@repo/ui/components/checkbox";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldTitle,
} from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { Textarea } from "@repo/ui/components/textarea";
import { updateSettingsAction } from "../_actions/admin-actions.ts";
import { ImageUploadField, type ImageUploadLabels } from "../_components/image-upload-field.tsx";
import { AdminCombobox } from "../_components/combobox.tsx";
import { useFieldErrors } from "../_hooks/use-field-errors.ts";
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

/**
 * Stands in for a JSON setting whose text does not parse. It can never match,
 * so the raw text fails as `invalid_format` and the row shows the ordinary
 * "not in the expected format" message through the same FieldError as every
 * other field — rather than a second, message-less error channel beside the
 * form's. Nothing unparseable is ever sent: the save stops at validation.
 */
const UNPARSEABLE_JSON = z.string().regex(/(?!)/);

export interface LocaleOption {
  code: string;
  name: string;
  nativeName: string;
}

function initialText(setting: SettingFieldData): string {
  if (setting.type === "JSON") return JSON.stringify(setting.value, null, 2);
  return String(setting.value ?? "");
}

/** The value a text-backed control sends for `raw` — what the action receives. */
function readValue(
  setting: SettingFieldData,
  raw: string,
): { ok: true; value: unknown } | { ok: false } {
  if (setting.type === "NUMBER") return { ok: true, value: Number(raw) };
  if (setting.type === "JSON") {
    try {
      return { ok: true, value: JSON.parse(raw) };
    } catch {
      return { ok: false };
    }
  }
  return { ok: true, value: raw };
}

/**
 * The asterisk is the schema's answer, not a hand-kept list: a setting is
 * required when its own schema refuses what this control sends while empty.
 */
function refusesEmpty(setting: SettingFieldData): boolean {
  if (!isKnownSettingKey(setting.key)) return false;
  if (setting.type === "BOOLEAN" || setting.type === "JSON") return false;
  const read = readValue(setting, "");
  if (!read.ok) return false;
  const schema: z.ZodType = SETTINGS_SCHEMAS[setting.key];
  return !schema.safeParse(read.value).success;
}

/** The same question for one sub-field of a structured (object/list) setting. */
function subFieldRefusesEmpty(key: string, field: SettingFieldDef): boolean {
  if (!isKnownSettingKey(key) || field.type === "boolean") return false;
  const root: z.ZodType = SETTINGS_SCHEMAS[key];
  const record = root instanceof z.ZodArray ? root.element : root;
  if (!(record instanceof z.ZodObject)) return false;
  const schema = record.shape[field.name];
  // What FieldControl sends for an emptied control: null for a number, "" else.
  return schema !== undefined && !z.safeParse(schema, field.type === "number" ? null : "").success;
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

  // The changed keys as the action will receive them, keyed for the schema:
  // `{ "site.name": "…" }` checked by `{ "site.name": SETTINGS_SCHEMAS["site.name"] }`,
  // so an issue's path IS the setting key (or `key.field` / `key.0.field`).
  const values: Record<string, unknown> = {};
  const shape: Record<string, z.ZodType> = {};
  for (const setting of settings) {
    if (!changedKeys.includes(setting.key)) continue;
    let schema: z.ZodType | undefined = isKnownSettingKey(setting.key)
      ? SETTINGS_SCHEMAS[setting.key]
      : undefined;
    if (SETTING_FIELDS[setting.key as SettingKey]) values[setting.key] = structured[setting.key];
    else if (setting.type === "BOOLEAN") values[setting.key] = booleans[setting.key] ?? false;
    else {
      const raw = text[setting.key] ?? "";
      const read = readValue(setting, raw);
      if (read.ok) values[setting.key] = read.value;
      else {
        values[setting.key] = raw;
        schema = UNPARSEABLE_JSON;
      }
    }
    // An unknown key has no schema here; the action refuses it by name.
    if (schema) shape[setting.key] = schema;
  }
  const form = useFieldErrors(z.object(shape), values);

  const submit = () => {
    if (!form.validate()) return;
    const entries = Object.entries(values).map(([key, value]) => ({ key, value }));
    if (entries.length === 0) return;
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

  const rowClass = (setting: SettingFieldData) =>
    cn("border-b pb-4", spansFullRow(setting) && "xl:col-span-2");

  const badges = (setting: SettingFieldData) => (
    <>
      <Badge variant="secondary">
        {setting.isPublic ? labels.publicBadge : labels.privateBadge}
      </Badge>
      <span className="text-xs text-muted-foreground">{humanizeKey(setting.key)}</span>
    </>
  );

  /** One control for one text-backed setting. Its Field supplies id and aria. */
  const renderControl = (setting: SettingFieldData) => {
    const value = text[setting.key] ?? "";
    const widget = SETTING_WIDGETS[setting.key as SettingKey];

    if (setting.type === "TEXT" || setting.type === "JSON") {
      return (
        <Textarea
          value={value}
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
        type={setting.type === "NUMBER" ? "number" : setting.type === "COLOR" ? "color" : "text"}
        value={value}
        onChange={(e) => setValue(setting.key, e.target.value)}
        className="w-full"
      />
    );
  };

  const renderRow = (setting: SettingFieldData) => {
    const id = `setting-${setting.key}`;

    // Not a control — a pointer to the screen that edits this value.
    const managedHref = MANAGED_ELSEWHERE[setting.key];
    if (managedHref) {
      return (
        <div key={setting.key} className={cn("flex flex-col gap-2", rowClass(setting))}>
          <div className="flex flex-wrap items-center gap-2">
            <FieldTitle>{setting.label}</FieldTitle>
            {badges(setting)}
          </div>
          {setting.description && (
            <p className="text-sm text-muted-foreground">{setting.description}</p>
          )}
          <Link
            href={managedHref}
            className="inline-flex w-fit items-center gap-1.5 text-sm text-primary-interactive hover:underline"
          >
            {labels.managedElsewhere}
            <ArrowRight aria-hidden className="size-3.5 rtl:rotate-180" />
          </Link>
        </div>
      );
    }

    // A group of sub-fields, each its own Field — so the row is a named
    // group, not a Field with one label pointing at no single control.
    const fieldsDef = SETTING_FIELDS[setting.key as SettingKey];
    if (fieldsDef) {
      const onChange = (next: unknown) =>
        setStructured((current) => ({ ...current, [setting.key]: next }));
      const shared = {
        settingKey: setting.key,
        def: fieldsDef,
        value: structured[setting.key],
        sources,
        labels: labels.fields,
        errorFor: form.error,
        isRequired: (field: SettingFieldDef) => subFieldRefusesEmpty(setting.key, field),
        onChange,
      };
      return (
        <div
          key={setting.key}
          role="group"
          aria-labelledby={`${id}-title`}
          className={cn("flex flex-col gap-2", rowClass(setting))}
        >
          <div className="flex flex-wrap items-center gap-2">
            <FieldTitle id={`${id}-title`}>{setting.label}</FieldTitle>
            {badges(setting)}
          </div>
          {setting.description && (
            <p className="text-sm text-muted-foreground">{setting.description}</p>
          )}
          {fieldsDef.shape === "list" ? <ListField {...shared} /> : <ObjectField {...shared} />}
          {/* A whole-list issue (too many rows) has no one sub-field to sit on. */}
          <FieldError>{form.error(setting.key)}</FieldError>
        </div>
      );
    }

    if (setting.type === "BOOLEAN") {
      return (
        <Field
          key={setting.key}
          orientation="horizontal"
          invalid={form.invalid(setting.key)}
          className={rowClass(setting)}
        >
          <Checkbox
            checked={booleans[setting.key] ?? false}
            onCheckedChange={(next) =>
              setBooleans((current) => ({ ...current, [setting.key]: next === true }))
            }
          />
          <FieldContent>
            <div className="flex flex-wrap items-center gap-2">
              <FieldLabel>{setting.label}</FieldLabel>
              {badges(setting)}
            </div>
            {setting.description && <FieldDescription>{setting.description}</FieldDescription>}
            <FieldError>{form.error(setting.key)}</FieldError>
          </FieldContent>
        </Field>
      );
    }

    if (setting.type === "IMAGE") {
      // The image widget is its own Field (label, required mark, message), so
      // it is not wrapped in another; the badges sit beneath it.
      return (
        <div key={setting.key} className={cn("flex flex-col gap-2", rowClass(setting))}>
          <ImageUploadField
            label={setting.label}
            description={setting.description ?? undefined}
            value={text[setting.key] ?? ""}
            purpose="setting"
            category="general"
            sourceType="SETTING"
            labels={labels.upload}
            required={refusesEmpty(setting)}
            error={form.error(setting.key)}
            onChange={(next) => setValue(setting.key, next?.url ?? "")}
          />
          <div className="flex flex-wrap items-center gap-2">{badges(setting)}</div>
        </div>
      );
    }

    return (
      <Field
        key={setting.key}
        invalid={form.invalid(setting.key)}
        required={refusesEmpty(setting)}
        className={rowClass(setting)}
      >
        <div className="flex flex-wrap items-center gap-2">
          <FieldLabel>{setting.label}</FieldLabel>
          {badges(setting)}
        </div>
        {setting.description && <FieldDescription>{setting.description}</FieldDescription>}
        {renderControl(setting)}
        <FieldError>{form.error(setting.key)}</FieldError>
      </Field>
    );
  };

  return (
    // `noValidate`: the controls now carry `required`, and the browser's own
    // bubbles would otherwise block the submit before the inline messages
    // (ADR-077) — which say the same thing, in the page, per field — can run.
    <form
      noValidate
      className="grid grid-cols-1 items-start gap-x-8 gap-y-5 xl:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      {settings.map((setting) => renderRow(setting))}
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
        <Button type="submit" disabled={!dirty} loading={pending}>
          {labels.save}
        </Button>
      </div>
    </form>
  );
}

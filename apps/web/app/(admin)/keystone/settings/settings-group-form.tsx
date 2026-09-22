"use client";

// One settings section = ONE form = ONE Save (changes-02). Fields render
// by registry type (SKILL.md: STRING/TEXT/NUMBER/BOOLEAN/JSON/IMAGE/COLOR/
// SELECT, and DOCUMENT since ADR-110) plus the widget hints in
// @repo/contracts (timezone / locale /
// select dropdowns). Only changed keys are submitted; the server validates
// every entry before writing any, so a bad field saves nothing.
//
// Inline validation (ADR-077) uses the SAME per-key schemas the settings
// service parses with (`SETTINGS_SCHEMAS`), over exactly the changed keys the
// action will receive — so an unchanged, already-stored value is not judged
// here either, just as it is not judged there.
import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowRight } from "lucide-react";
import { z } from "zod";
import {
  SETTINGS_SCHEMAS,
  validateFields,
  SETTING_FIELDS,
  SETTING_SELECT_OPTIONS,
  SETTING_WIDGETS,
  isKnownSettingKey,
  megabyteChoices,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/ui/components/tabs";
import { Textarea } from "@repo/ui/components/textarea";
import { updateSettingsAction } from "../_actions/admin-actions.ts";
import { ImageUploadField, type ImageUploadLabels } from "../_components/image-upload-field.tsx";
import { DocumentPickerField } from "../_components/document-picker-field.tsx";
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

/**
 * One tab of a tabbed group (changes-50: "the general settings page should be
 * shown in tabs"). A tab lists the setting KEYS it holds, or carries its own
 * `content` — a screen that saves on its own (the Branding tab's uploads) and
 * so draws no Save beneath it.
 */
export interface SettingsTab {
  id: string;
  label: string;
  keys?: readonly string[];
  content?: React.ReactNode;
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
  "home.sections": "/keystone/homepage",
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
  tabs,
}: {
  settings: SettingFieldData[];
  locales: LocaleOption[];
  /** Resolves SETTING_FIELDS' `optionsFrom: "menus"` choices. */
  menus: { value: string; label: string }[];
  labels: SettingsGroupLabels;
  /** Split the group into tabs. Absent means one grid, as every other group. */
  tabs?: SettingsTab[];
}) {
  const { run, pending } = useServerAction();
  const [tab, setTab] = React.useState(tabs?.[0]?.id ?? "");
  // The SELECT option names only (ADR-105 #7). Every other string on this
  // screen still arrives in `labels` from the server component — these are
  // read here for the reason `AdminCombobox` reads its two: the alternative
  // is a catalog entry per option threaded through the props of a form that
  // does not know which keys it is rendering.
  const t = useTranslations("admin");
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

  // Which tab a setting sits on. A key no tab names lands on the FIRST field
  // tab, so a general setting added later is never unreachable.
  const fieldTabs = (tabs ?? []).filter((t) => !t.content);
  const tabFor = (key: string) =>
    (fieldTabs.find((t) => t.keys?.includes(key)) ?? fieldTabs[0])?.id;

  const submit = () => {
    // An invalid field on a tab that is not open cannot be focused, so open
    // its tab first and let `validate()` name and focus it as usual.
    const firstInvalid = Object.keys(validateFields(z.object(shape), values))[0];
    // An issue's path IS the setting key, or `key.field` / `key.0.field`, and
    // a key has dots of its own, so it is matched as a prefix, never split.
    const invalidKey = settings.find(
      (setting) => firstInvalid === setting.key || firstInvalid?.startsWith(`${setting.key}.`),
    )?.key;
    const invalidTab = invalidKey ? tabFor(invalidKey) : undefined;
    if (tabs && invalidTab && invalidTab !== tab) {
      setTab(invalidTab);
      requestAnimationFrame(() => form.validate());
      return;
    }
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
    // A document row is a filename plus three buttons — it does not fit a
    // half-row any better than an image preview does.
    setting.type === "DOCUMENT" ||
    // Structured list/object editors are tables of sub-fields, not one
    // control — they never fit a half-row.
    Boolean(SETTING_FIELDS[setting.key as SettingKey]);

  const rowClass = (setting: SettingFieldData) =>
    cn("border-b pb-4", spansFullRow(setting) && "xl:col-span-2");

  // changes-50 (image-2): the badge and the key's name are DETAILS about a
  // field, so they sit UNDER its input with its description. The label row
  // carries the label alone, and the eye goes label, then control.
  const badges = (setting: SettingFieldData) => (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant="secondary">
        {setting.isPublic ? labels.publicBadge : labels.privateBadge}
      </Badge>
      <span className="text-xs text-muted-foreground">{humanizeKey(setting.key)}</span>
    </div>
  );

  /**
   * A SELECT option's words (ADR-105 #7). ADR-044 #5's two-step — catalog
   * key first, `humanizeKey()` second — applied one level below the setting
   * label, where the form had been printing the stored value verbatim.
   * Survivable for `light`/`dark`/`system`; meaningless for `2`.
   */
  const optionLabel = (key: string, option: string) => {
    const catalogKey = `settingOptions.${key}.${option}`;
    return t.has(catalogKey as "settingsTitle")
      ? t(catalogKey as "settingsTitle")
      : humanizeKey(option);
  };

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

    // changes-46: an upload cap is chosen in MB and stored in bytes, so the
    // option VALUE is the byte count the action already expects and only the
    // label speaks megabytes. `megabyteChoices` keeps a stored size that is
    // not on the list, so opening the screen never changes a cap by itself.
    if (widget === "megabytes") {
      const stored = Number(value);
      const options = megabyteChoices(
        setting.key as SettingKey,
        value !== "" && Number.isFinite(stored) ? stored : null,
      ).map((choice) => ({
        value: String(choice.bytes),
        label: t("settingMegabytes", { size: choice.megabytes }),
      }));
      return (
        <AdminCombobox
          value={value}
          onValueChange={(v) => setValue(setting.key, v)}
          placeholder={labels.selectPlaceholder}
          options={options}
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
                label: optionLabel(setting.key, o),
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
          <FieldTitle>{setting.label}</FieldTitle>
          <Link
            href={managedHref}
            className="inline-flex w-fit items-center gap-1.5 text-sm text-primary-interactive hover:underline"
          >
            {labels.managedElsewhere}
            <ArrowRight aria-hidden className="size-3.5 rtl:rotate-180" />
          </Link>
          {setting.description && (
            <p className="text-sm text-muted-foreground">{setting.description}</p>
          )}
          {badges(setting)}
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
          <FieldTitle id={`${id}-title`}>{setting.label}</FieldTitle>
          {fieldsDef.shape === "list" ? <ListField {...shared} /> : <ObjectField {...shared} />}
          {/* A whole-list issue (too many rows) has no one sub-field to sit on. */}
          <FieldError>{form.error(setting.key)}</FieldError>
          {setting.description && (
            <p className="text-sm text-muted-foreground">{setting.description}</p>
          )}
          {badges(setting)}
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
            <FieldLabel>{setting.label}</FieldLabel>
            <FieldError>{form.error(setting.key)}</FieldError>
            {setting.description && <FieldDescription>{setting.description}</FieldDescription>}
            {badges(setting)}
          </FieldContent>
        </Field>
      );
    }

    if (setting.type === "DOCUMENT") {
      // Its own Field (label, required mark, message), like the image widget
      // — so it is not wrapped in another; the badges sit beneath it.
      return (
        <div key={setting.key} className={cn("flex flex-col gap-2", rowClass(setting))}>
          <DocumentPickerField
            label={setting.label}
            description={setting.description ?? undefined}
            value={text[setting.key] ?? ""}
            required={refusesEmpty(setting)}
            error={form.error(setting.key)}
            onChange={(next) => setValue(setting.key, next)}
          />
          {badges(setting)}
        </div>
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
          {badges(setting)}
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
        <FieldLabel>{setting.label}</FieldLabel>
        {renderControl(setting)}
        <FieldError>{form.error(setting.key)}</FieldError>
        {setting.description && <FieldDescription>{setting.description}</FieldDescription>}
        {badges(setting)}
      </Field>
    );
  };

  // changes-38: typed inputs first, then the file pickers. Legal read terms
  // PDF, privacy PDF, agreement PDF, then the copyright line: seed order, and
  // a picker between two text boxes. A stable partition, so every other group
  // keeps its seeded order.
  const ordered = [
    ...settings.filter((setting) => setting.type !== "DOCUMENT"),
    ...settings.filter((setting) => setting.type === "DOCUMENT"),
  ];
  const grid = (list: SettingFieldData[]) => (
    <div className="grid grid-cols-1 items-start gap-x-8 gap-y-5 xl:grid-cols-2">
      {list.map((setting) => renderRow(setting))}
    </div>
  );
  // A tab with its own content saves on its own, so no Save is drawn under it.
  const showSave = !tabs?.find((t) => t.id === tab)?.content;

  return (
    // `noValidate`: the controls now carry `required`, and the browser's own
    // bubbles would otherwise block the submit before the inline messages
    // (ADR-077), which say the same thing in the page per field, can run.
    <form
      noValidate
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      {tabs ? (
        <Tabs value={tab} onValueChange={(next) => setTab(String(next))}>
          <TabsList>
            {tabs.map((t) => (
              <TabsTrigger key={t.id} value={t.id}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {tabs.map((t) => (
            <TabsContent key={t.id} value={t.id} className="pt-5">
              {t.content ?? grid(ordered.filter((setting) => tabFor(setting.key) === t.id))}
            </TabsContent>
          ))}
        </Tabs>
      ) : (
        grid(ordered)
      )}
      {/* changes-08 #3: Save at the inline-END of the section. The
          dirty-field summary reads BEFORE it (start-aligned) so the button
          keeps the corner every other confirming action in the admin uses.
          #2: the summary names the changed fields in words, not raw
          setting keys. */}
      {showSave && (
        <div className="flex flex-wrap items-center justify-end gap-3 border-t pt-4">
          {dirty && (
            <span className="me-auto text-xs text-muted-foreground">
              {changedKeys.length} · {changedKeys.map((key) => humanizeKey(key)).join(", ")}
            </span>
          )}
          <Button type="submit" disabled={!dirty} loading={pending}>
            {labels.save}
          </Button>
        </div>
      )}
    </form>
  );
}

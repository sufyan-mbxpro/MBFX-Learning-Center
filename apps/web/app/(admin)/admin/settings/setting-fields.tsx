"use client";

// Structured editors for JSON-shaped settings (changes-03-plan.md §12.5).
//
// Generic on purpose: these read the flat field descriptors in
// @repo/contracts' SETTING_FIELDS rather than knowing any particular
// setting, so the next JSON setting is a data change beside its Zod schema,
// not a new form component. The raw JSON textarea remains the fallback for
// keys with no descriptors.
//
// Each sub-field is a `Field` (ADR-077): its label, required mark and inline
// message are wired by the Field, and the message comes from the setting's
// own schema at the sub-field's path (`header.cta.url`,
// `footer.appLinks.0.url`) — the caller passes `errorFor`/`isRequired`.
import { Plus, Trash2 } from "lucide-react";
import type { SettingFieldDef, SettingFieldsDef } from "@repo/contracts";
import { Button } from "@repo/ui/components/button";
import { Checkbox } from "@repo/ui/components/checkbox";
import { Field, FieldError, FieldLabel } from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { ConfirmDialog } from "@repo/ui/components/confirm-dialog";
import { EmptyState } from "@repo/ui/components/empty";
import { AdminCombobox } from "../_components/combobox.tsx";

export interface SettingFieldsLabels {
  addRow: string;
  removeRow: string;
  emptyList: string;
  selectPlaceholder: string;
  /** changes-08 #6 — removing a row confirms first. */
  cancel: string;
  confirmRemoveTitle: string;
  confirmRemoveBody: string;
  /** Field label per `labelKey`, resolved from the catalog by the caller. */
  field: Record<string, string>;
}

export interface FieldOptionSources {
  menus: { value: string; label: string }[];
}

/** Inline validation hooks from the form that owns the schema (ADR-077). */
export interface SubFieldValidation {
  /** The message at a dotted schema path, once a save has been attempted. */
  errorFor?: (path: string) => string | undefined;
  /** Whether the setting's schema refuses this sub-field left empty. */
  isRequired?: (field: SettingFieldDef) => boolean;
}

type Row = Record<string, unknown>;

function optionsFor(
  field: SettingFieldDef,
  sources: FieldOptionSources,
): { value: string; label: string }[] {
  if (field.optionsFrom === "menus") return sources.menus;
  return (field.options ?? []).map((option) => ({ value: option, label: option }));
}

/** One control for one flat field. Its Field supplies the id and aria wiring. */
function FieldControl({
  field,
  value,
  sources,
  labels,
  onChange,
}: {
  field: SettingFieldDef;
  value: unknown;
  sources: FieldOptionSources;
  labels: SettingFieldsLabels;
  onChange: (next: unknown) => void;
}) {
  if (field.type === "select") {
    const options = optionsFor(field, sources);
    return (
      <AdminCombobox
        value={String(value ?? "")}
        onValueChange={onChange}
        placeholder={labels.selectPlaceholder}
        options={options.map((option) => ({ value: option.value, label: option.label }))}
      />
    );
  }

  return (
    <Input
      type={field.type === "number" ? "number" : "text"}
      // `url` stays a text input rather than type="url": these accept a
      // site-relative path ("/x") too, which browser URL validation rejects.
      // The Zod schema is the real guard (security.md #6).
      inputMode={field.type === "url" ? "url" : undefined}
      value={value === undefined || value === null ? "" : String(value)}
      onChange={(e) =>
        onChange(
          field.type === "number"
            ? e.target.value === ""
              ? null
              : Number(e.target.value)
            : e.target.value,
        )
      }
      className="w-full"
    />
  );
}

/** One labelled sub-field: a checkbox row, or a label above its control. */
function SubField({
  path,
  field,
  value,
  sources,
  labels,
  validation,
  className,
  onChange,
}: {
  path: string;
  field: SettingFieldDef;
  value: unknown;
  sources: FieldOptionSources;
  labels: SettingFieldsLabels;
  validation: SubFieldValidation;
  className?: string;
  onChange: (next: unknown) => void;
}) {
  const label = labels.field[field.labelKey] ?? field.name;
  const error = validation.errorFor?.(path);

  if (field.type === "boolean") {
    return (
      <Field orientation="horizontal" invalid={error !== undefined} className={className}>
        <Checkbox checked={value === true} onCheckedChange={(next) => onChange(next === true)} />
        <FieldLabel className="text-xs">{label}</FieldLabel>
      </Field>
    );
  }

  return (
    <Field
      invalid={error !== undefined}
      required={validation.isRequired?.(field) ?? false}
      className={className}
    >
      <FieldLabel className="text-xs">{label}</FieldLabel>
      <FieldControl
        field={field}
        value={value}
        sources={sources}
        labels={labels}
        onChange={onChange}
      />
      <FieldError>{error}</FieldError>
    </Field>
  );
}

/** Edits ONE record — header.topBar, header.cta, header.announcementBar. */
export function ObjectField({
  settingKey,
  def,
  value,
  sources,
  labels,
  errorFor,
  isRequired,
  onChange,
}: {
  settingKey: string;
  def: SettingFieldsDef;
  value: unknown;
  sources: FieldOptionSources;
  labels: SettingFieldsLabels;
  onChange: (next: Row) => void;
} & SubFieldValidation) {
  const record: Row = typeof value === "object" && value !== null ? (value as Row) : {};

  return (
    <div className="grid grid-cols-1 gap-x-6 gap-y-3 rounded-lg border bg-muted/30 p-4 md:grid-cols-2 xl:grid-cols-3">
      {def.fields.map((field) => (
        <SubField
          key={field.name}
          path={`${settingKey}.${field.name}`}
          field={field}
          value={record[field.name]}
          sources={sources}
          labels={labels}
          validation={{ errorFor, isRequired }}
          onChange={(next) => onChange({ ...record, [field.name]: next })}
        />
      ))}
    </div>
  );
}

/** Edits an ARRAY of records — footer.appLinks, footer.menuColumns. */
export function ListField({
  settingKey,
  def,
  value,
  sources,
  labels,
  errorFor,
  isRequired,
  onChange,
}: {
  settingKey: string;
  def: SettingFieldsDef;
  value: unknown;
  sources: FieldOptionSources;
  labels: SettingFieldsLabels;
  onChange: (next: Row[]) => void;
} & SubFieldValidation) {
  const rows: Row[] = Array.isArray(value) ? (value as Row[]) : [];

  /** Position drives `orderField`, so the two can never disagree. */
  const withOrder = (next: Row[]): Row[] =>
    def.orderField
      ? next.map((row, index) => ({ ...row, [def.orderField as string]: index + 1 }))
      : next;

  const blankRow = (): Row =>
    Object.fromEntries(
      def.fields.map((field) => [field.name, field.type === "boolean" ? false : ""]),
    );

  return (
    <div className="flex flex-col gap-2">
      {rows.length === 0 && <EmptyState size="sm" title={labels.emptyList} />}

      {rows.map((row, index) => (
        <div
          key={index}
          className="flex flex-wrap items-end gap-3 rounded-lg border bg-muted/30 p-3"
        >
          {def.fields.map((field) => (
            <SubField
              key={field.name}
              path={`${settingKey}.${index}.${field.name}`}
              field={field}
              value={row[field.name]}
              sources={sources}
              labels={labels}
              validation={{ errorFor, isRequired }}
              className="min-w-56 flex-1"
              onChange={(next) =>
                onChange(
                  withOrder(rows.map((r, i) => (i === index ? { ...r, [field.name]: next } : r))),
                )
              }
            />
          ))}
          {/* changes-08 #6: dropping a row loses whatever was typed into
              it, so it asks — the same confirmation every other remove in
              the admin shows. */}
          <ConfirmDialog
            trigger={
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                aria-label={`${labels.removeRow} ${index + 1}`}
              >
                <Trash2 aria-hidden className="size-3.5" />
              </Button>
            }
            title={labels.confirmRemoveTitle}
            description={labels.confirmRemoveBody}
            confirmLabel={labels.removeRow}
            cancelLabel={labels.cancel}
            onConfirm={() => onChange(withOrder(rows.filter((_, i) => i !== index)))}
          />
        </div>
      ))}

      <div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange(withOrder([...rows, blankRow()]))}
        >
          <Plus data-icon="inline-start" aria-hidden />
          {labels.addRow}
        </Button>
      </div>
    </div>
  );
}

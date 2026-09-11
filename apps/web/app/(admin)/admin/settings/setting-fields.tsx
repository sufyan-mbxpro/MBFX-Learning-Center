"use client";

// Structured editors for JSON-shaped settings (changes-03-plan.md §12.5).
//
// Generic on purpose: these read the flat field descriptors in
// @repo/contracts' SETTING_FIELDS rather than knowing any particular
// setting, so the next JSON setting is a data change beside its Zod schema,
// not a new form component. The raw JSON textarea remains the fallback for
// keys with no descriptors.
import { Plus, Trash2 } from "lucide-react";
import type { SettingFieldDef, SettingFieldsDef } from "@repo/contracts";
import { Button } from "@repo/ui/components/button";
import { Checkbox } from "@repo/ui/components/checkbox";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { ConfirmDialog } from "@repo/ui/components/confirm-dialog";
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

type Row = Record<string, unknown>;

function optionsFor(
  field: SettingFieldDef,
  sources: FieldOptionSources,
): { value: string; label: string }[] {
  if (field.optionsFrom === "menus") return sources.menus;
  return (field.options ?? []).map((option) => ({ value: option, label: option }));
}

/** One control for one flat field. */
function FieldControl({
  id,
  field,
  value,
  sources,
  labels,
  onChange,
}: {
  id: string;
  field: SettingFieldDef;
  value: unknown;
  sources: FieldOptionSources;
  labels: SettingFieldsLabels;
  onChange: (next: unknown) => void;
}) {
  if (field.type === "boolean") {
    return (
      <Checkbox
        id={id}
        checked={value === true}
        onCheckedChange={(next) => onChange(next === true)}
      />
    );
  }

  if (field.type === "select") {
    const options = optionsFor(field, sources);
    return (
      <AdminCombobox
        id={id}
        value={String(value ?? "")}
        onValueChange={onChange}
        placeholder={labels.selectPlaceholder}
        options={options.map((option) => ({ value: option.value, label: option.label }))}
      />
    );
  }

  return (
    <Input
      id={id}
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

/** Edits ONE record — header.topBar, header.cta, header.announcementBar. */
export function ObjectField({
  settingKey,
  def,
  value,
  sources,
  labels,
  onChange,
}: {
  settingKey: string;
  def: SettingFieldsDef;
  value: unknown;
  sources: FieldOptionSources;
  labels: SettingFieldsLabels;
  onChange: (next: Row) => void;
}) {
  const record: Row = typeof value === "object" && value !== null ? (value as Row) : {};

  return (
    <div className="grid grid-cols-1 gap-x-6 gap-y-3 rounded-lg border bg-muted/30 p-4 md:grid-cols-2 xl:grid-cols-3">
      {def.fields.map((field) => {
        const id = `setting-${settingKey}-${field.name}`;
        return (
          <div key={field.name} className="flex flex-col gap-1.5">
            <Label htmlFor={id} className="text-xs">
              {labels.field[field.labelKey] ?? field.name}
            </Label>
            <FieldControl
              id={id}
              field={field}
              value={record[field.name]}
              sources={sources}
              labels={labels}
              onChange={(next) => onChange({ ...record, [field.name]: next })}
            />
          </div>
        );
      })}
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
  onChange,
}: {
  settingKey: string;
  def: SettingFieldsDef;
  value: unknown;
  sources: FieldOptionSources;
  labels: SettingFieldsLabels;
  onChange: (next: Row[]) => void;
}) {
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
      {rows.length === 0 && <p className="text-sm text-muted-foreground">{labels.emptyList}</p>}

      {rows.map((row, index) => (
        <div
          key={index}
          className="flex flex-wrap items-end gap-3 rounded-lg border bg-muted/30 p-3"
        >
          {def.fields.map((field) => {
            const id = `setting-${settingKey}-${index}-${field.name}`;
            return (
              <div key={field.name} className="flex min-w-56 flex-1 flex-col gap-1.5">
                <Label htmlFor={id} className="text-xs">
                  {labels.field[field.labelKey] ?? field.name}
                </Label>
                <FieldControl
                  id={id}
                  field={field}
                  value={row[field.name]}
                  sources={sources}
                  labels={labels}
                  onChange={(next) =>
                    onChange(
                      withOrder(
                        rows.map((r, i) => (i === index ? { ...r, [field.name]: next } : r)),
                      ),
                    )
                  }
                />
              </div>
            );
          })}
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

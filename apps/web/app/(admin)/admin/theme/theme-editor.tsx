"use client";

// Theme editor client shell (Module 09 core). Tabs mirror the engine:
// Colors (BRAND_FIELD_REGISTRY-driven), Layout & Display, Theme Modes
// side-by-side, Presets. The logos and favicon moved to Settings → General →
// Branding in changes-50. validateTheme runs SERVER-side in
// saveThemeAction — this component renders the returned issues verbatim;
// blocking errors mean the save was refused (SKILL.md). Live preview
// iframe is the remaining deferred polish.
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Bookmark, CircleAlert, CircleCheck, Trash2, TriangleAlert, Wand2 } from "lucide-react";
// Type-only imports — erased at compile time, so no next/cache pulls into
// the client bundle.
import type {
  BrandColors,
  BrandOverrides,
  ContrastIssue,
  LayoutTokens,
  SurfacePalette,
} from "@repo/theme";
import Link from "next/link";
import { saveThemePresetSchema, saveThemeSchema, type ThemeSurface } from "@repo/contracts";
import { humanizeKey } from "@repo/utils";
import { cn } from "@repo/ui/lib/utils";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@repo/ui/components/accordion";
import { Button } from "@repo/ui/components/button";
import { ConfirmDialog } from "@repo/ui/components/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog";
import { Field, FieldError, FieldLabel } from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { Textarea } from "@repo/ui/components/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/ui/components/tabs";
import {
  activateThemeAction,
  deleteThemePresetAction,
  saveThemeAction,
  saveThemePresetAction,
} from "../_actions/admin-actions.ts";
import { StatusBadge } from "../_components/status-badge.tsx";
import { AdminCombobox } from "../_components/combobox.tsx";
import { useFieldErrors } from "../_hooks/use-field-errors.ts";
import { useServerAction } from "../_hooks/use-server-action.ts";

interface Labels {
  brand: string;
  layout: string;
  modes: string;
  presets: string;
  lightSurface: string;
  darkSurface: string;
  save: string;
  saved: string;
  activate: string;
  activeBadge: string;
  surfaceLabel: string;
  surfaceWeb: string;
  surfaceAdmin: string;
  surfaceHint: string;
  issues: string;
  blockingError: string;
  advisory: string;
  derivedPreview: string;
  saveBlocked: string;
  needsRatio: string;
  hexValue: string;
  fieldLabels: Record<string, string>;
}

const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}$/;

// Structural design (container width, radius, base font size, curated font
// pickers) is paused per ADR-038 — the owner wants layout/typography design
// handled module-by-module in code, not admin-editable. Values already
// saved keep rendering exactly as before; only this tab's editing UI is
// hidden. Flip back to `true` to restore it.
const THEME_LAYOUT_TAB_ENABLED = false;

function ColorField({
  id,
  label,
  hexLabel,
  value,
  error,
  onChange,
}: {
  id: string;
  label: string;
  hexLabel: string;
  value: string;
  /** The inline message from `saveThemeSchema` (ADR-077). */
  error?: string;
  onChange: (v: string) => void;
}) {
  // The native swatch is imprecise for landing on an exact hex (its own
  // slider/eyedropper picker easily drifts to an unintended value) — this
  // text field is the reliable way to set one, kept in local draft state so
  // a mid-typed value isn't lost before it completes to a valid hex, and
  // reverted to the last valid `value` on blur if it never does. Resetting
  // draft when `value` changes from outside (swatch pick, preset activate)
  // happens during render — not a useEffect — per React's documented
  // "adjusting state when a prop changes" pattern: it avoids the extra
  // render pass an effect would cause and the lint rule that flags it.
  const [draft, setDraft] = useState(value);
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    setDraft(value);
  }

  const commit = (next: string) => {
    setDraft(next);
    if (HEX_COLOR_RE.test(next)) onChange(next);
  };

  // Every swatch is required by `saveThemeSchema`. The label names the
  // swatch (`controlId` keeps its long-standing id); the hex box is the same
  // value typed, so it shares the Field's invalid state and message under an
  // id of its own.
  return (
    <Field invalid={error !== undefined} required controlId={id}>
      <div className="flex items-center gap-3">
        <Input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-14 p-1"
        />
        <FieldLabel className="flex-1">{label}</FieldLabel>
        {/* `font-mono`: a hex value is read character by character (ADR-044 #6). */}
        <Input
          id={`${id}-hex`}
          aria-label={`${label} ${hexLabel}`}
          value={draft}
          onChange={(e) => commit(e.target.value)}
          onBlur={() => setDraft(value)}
          maxLength={7}
          className="w-24 font-mono text-xs"
        />
      </div>
      <FieldError>{error}</FieldError>
    </Field>
  );
}

export interface ThemePresetView {
  key: string;
  name: string;
  description: string | null;
  isActive: boolean;
  isSystem: boolean;
  swatches: string[];
  lightBackground: string | null;
  darkBackground: string | null;
}

export function ThemeEditor({
  themeKey,
  surface,
  initial,
  derived,
  initialIssues,
  presets,
  brandFields,
  fonts,
  labels,
}: {
  themeKey: string;
  /** The surface whose palette this editor is changing (ADR-148). */
  surface: ThemeSurface;
  initial: {
    brand: BrandColors;
    light: SurfacePalette;
    dark: SurfacePalette;
    overrides: BrandOverrides;
    layout: LayoutTokens;
  };
  derived: { interactive: string; interactiveDark: string };
  /** The saved palette's issues, so the editor opens with them shown. */
  initialIssues: ContrastIssue[];
  presets: ThemePresetView[];
  brandFields: string[];
  fonts: { key: string; label: string; category: string }[];
  labels: Labels;
}) {
  const [brand, setBrand] = useState(initial.brand);
  const [light, setLight] = useState(initial.light);
  const [dark, setDark] = useState(initial.dark);
  const [layout, setLayout] = useState(initial.layout);
  const [issues, setIssues] = useState<ContrastIssue[]>(initialIssues);
  // Indices of issues whose suggestion has been applied since the last save:
  // the swatch changed, but only a save re-runs the (server-side) check.
  const [applied, setApplied] = useState<ReadonlySet<number>>(new Set());
  const [presetOpen, setPresetOpen] = useState(false);
  const [presetToDelete, setPresetToDelete] = useState<ThemePresetView | null>(null);
  const te = useTranslations("admin.themeEditor");
  // Which tab is open decides whether Save is drawn (changes-43): Presets
  // activate on their own button, so a Save under it was a permanently
  // disabled control that looked like it was owed a click.
  const [tab, setTab] = useState("brand");
  const tabUsesSave = tab === "brand" || tab === "layout" || tab === "modes";
  const { run, pending } = useServerAction();
  const activePreset = presets.find((preset) => preset.isActive) ?? null;

  // Registry token ids ("primaryHover") shown as words ("Primary Hover")
  // when no catalog label exists — the registry is code-defined, so the id
  // IS the canonical name. One shared humanizer across the admin
  // (changes-08 #2) rather than a per-screen variant.
  const fieldLabel = (field: string) => labels.fieldLabels[field] ?? humanizeKey(field);

  // Save only means anything when something changed — and a disabled clean
  // button doubles as "your edits are saved" feedback.
  const dirty = useMemo(
    () =>
      JSON.stringify({ brand, light, dark, layout }) !==
      JSON.stringify({
        brand: initial.brand,
        light: initial.light,
        dark: initial.dark,
        layout: initial.layout,
      }),
    [brand, light, dark, layout, initial],
  );

  // Exactly what the action receives, checked by the schema it parses with
  // (ADR-077). Contrast is NOT judged here — `validateTheme` runs server-side
  // and its issues render below as before.
  const payload = {
    themeKey,
    brandColors: brand,
    lightSurface: light,
    darkSurface: dark,
    darkBrandOverrides: initial.overrides,
    layoutTokens: layout,
  };
  const form = useFieldErrors(saveThemeSchema, payload);

  const save = () => {
    if (!form.validate()) return;
    run(
      async () => {
        const result = await saveThemeAction(payload);
        setIssues(result.issues);
        setApplied(new Set());
        if (!result.saved) throw new Error(labels.saveBlocked);
      },
      { successMessage: labels.saved },
    );
  };

  // ─── Issue messages (changes-46) ───────────────────────────
  // "a clear human-readable message & suggest the colour that should be
  // added in which input". Every sentence is built from the issue's
  // structured fields and the catalog — never from the engine's English
  // `label`/`remedy`, which are for tests and logs.
  const inputName = (issue: ContrastIssue) => te("inputName", { name: fieldLabel(issue.field) });
  const where = (issue: ContrastIssue) =>
    issue.palette === "brand"
      ? te("whereBrand", { tab: labels.brand })
      : te("whereSurface", {
          palette: issue.palette === "dark" ? labels.darkSurface : labels.lightSurface,
          tab: labels.modes,
        });
  const issueTitle = (issue: ContrastIssue) => {
    const values = {
      input: inputName(issue),
      direction: issue.direction,
      mode: issue.mode,
      surface: issue.against ?? "background",
    };
    return te(`issueTitle.${issue.kind}`, values);
  };
  const issueBody = (issue: ContrastIssue) => {
    const measured = te(issue.kind === "border" ? "measuredBorder" : "measured", {
      ratio: issue.ratio,
      required: issue.required,
    });
    const explain =
      issue.kind === "linkText"
        ? te("autoFixed", { rendered: issue.rendered ?? "", input: inputName(issue) })
        : issue.kind === "buttonLabel"
          ? te("noLabelInk", { required: issue.required })
          : te("usedAsIs");
    return `${measured} ${explain}`;
  };

  /** The editor input an issue points at, and a way to set it. */
  const applySuggestion = (issue: ContrastIssue, index: number) => {
    const value = issue.suggestion;
    if (!value) return;
    if (issue.palette === "brand") {
      setBrand((current) => ({ ...current, [issue.field]: value }));
      setTab("brand");
    } else if (issue.palette === "light") {
      setLight((current) => ({ ...current, [issue.field]: value }));
      setTab("modes");
    } else if (issue.palette === "dark") {
      setDark((current) => ({ ...current, [issue.field]: value }));
      setTab("modes");
    }
    setApplied((current) => new Set(current).add(index));
    // Put the admin on the input that changed, so "which input" is shown as
    // well as said. After the tab switch has rendered.
    const id =
      issue.palette === "brand"
        ? `brand-${issue.field}-hex`
        : `${issue.palette}-${issue.field}-hex`;
    requestAnimationFrame(() => document.getElementById(id)?.focus());
  };

  const presetPayload = {
    brandColors: brand,
    lightSurface: light,
    darkSurface: dark,
    darkBrandOverrides: initial.overrides,
    layoutTokens: layout,
  };

  const surfaceEditor = (
    palette: SurfacePalette,
    setPalette: (p: SurfacePalette) => void,
    prefix: string,
    /** The palette's key in the action payload — its schema path. */
    path: "lightSurface" | "darkSurface",
  ) => (
    <div className="flex flex-col gap-2.5">
      {Object.entries(palette).map(([field, value]) => (
        <ColorField
          key={field}
          id={`${prefix}-${field}`}
          label={fieldLabel(field)}
          hexLabel={labels.hexValue}
          value={value}
          error={form.error(`${path}.${field}`)}
          onChange={(v) => setPalette({ ...palette, [field]: v })}
        />
      ))}
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      {/* changes-49 (ADR-148): the public site and the admin each own a
          palette. The switch is a pair of LINKS, not client state — the
          surface is a query parameter the server reads, so each palette
          loads fresh and a reload keeps the one being edited. */}
      <div className="flex flex-col gap-1.5">
        <nav aria-label={labels.surfaceLabel} className="flex w-fit rounded-lg bg-muted p-1">
          {(
            [
              ["web", labels.surfaceWeb],
              ["admin", labels.surfaceAdmin],
            ] as const
          ).map(([value, label]) => (
            <Link
              key={value}
              href={`/admin/theme?surface=${value}`}
              aria-current={surface === value ? "page" : undefined}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
                surface === value && "bg-background text-foreground shadow-sm",
              )}
            >
              {label}
            </Link>
          ))}
        </nav>
        <p className="text-xs text-muted-foreground">{labels.surfaceHint}</p>
      </div>

      <Tabs value={tab} onValueChange={(next) => setTab(String(next))}>
        <TabsList>
          <TabsTrigger value="brand">{labels.brand}</TabsTrigger>
          {THEME_LAYOUT_TAB_ENABLED && <TabsTrigger value="layout">{labels.layout}</TabsTrigger>}
          <TabsTrigger value="modes">{labels.modes}</TabsTrigger>
          <TabsTrigger value="presets">{labels.presets}</TabsTrigger>
        </TabsList>

        {/* changes-08 #5: Brand & Colours is TWO columns at most. A colour
            row is a label, a swatch and a hex field — at three columns the
            hex inputs were squeezed to the point of truncating, and the
            eye has to scan three ways to compare two related tones. */}
        <TabsContent
          value="brand"
          className="grid grid-cols-1 items-start gap-x-8 gap-y-3 pt-4 md:grid-cols-2"
        >
          {brandFields.map((field) => (
            <ColorField
              key={field}
              id={`brand-${field}`}
              label={fieldLabel(field)}
              hexLabel={labels.hexValue}
              value={brand[field as keyof BrandColors]}
              error={form.error(`brandColors.${field}`)}
              onChange={(v) => setBrand({ ...brand, [field]: v })}
            />
          ))}
          <div className="mt-2 rounded-md border p-3 md:col-span-2">
            <p className="mb-2 text-sm font-medium">{labels.derivedPreview}</p>
            <div className="flex flex-col gap-1.5">
              {[derived.interactive, derived.interactiveDark].map((color, i) => (
                <span key={i} className="flex items-center gap-2 text-xs">
                  <span
                    aria-hidden
                    className="size-5 shrink-0 rounded border"
                    style={{ backgroundColor: color }}
                  />
                  <span className="tracking-wide text-muted-foreground uppercase">{color}</span>
                </span>
              ))}
            </div>
          </div>
        </TabsContent>

        {THEME_LAYOUT_TAB_ENABLED && (
          <TabsContent
            value="layout"
            className="grid grid-cols-1 gap-3 pt-4 md:grid-cols-2 xl:grid-cols-3"
          >
            {(["radiusBase", "containerWidth", "baseFontSize"] as const).map((field) => (
              <Field
                key={field}
                invalid={form.invalid(`layoutTokens.${field}`)}
                // `baseFontSize` is the one optional layout token in the schema.
                required={field !== "baseFontSize"}
              >
                <FieldLabel>{fieldLabel(field)}</FieldLabel>
                <Input
                  value={layout[field]}
                  onChange={(e) => setLayout({ ...layout, [field]: e.target.value })}
                  className="w-full"
                />
                <FieldError>{form.error(`layoutTokens.${field}`)}</FieldError>
              </Field>
            ))}
            {(["fontSans", "fontDisplay", "fontMono"] as const).map((field) => {
              // `fontDisplay` (ADR-102) offers the serifs AND the sans faces:
              // a site that wants no serif headings points it at a sans key
              // rather than being told it has no choice.
              const options = fonts.filter((f) =>
                field === "fontSans"
                  ? f.category === "sans"
                  : field === "fontDisplay"
                    ? f.category !== "mono"
                    : f.category === "mono",
              );
              return (
                <Field
                  key={field}
                  invalid={form.invalid(`layoutTokens.${field}`)}
                  // The one optional font slot: absent means the sans.
                  required={field !== "fontDisplay"}
                >
                  <FieldLabel>{fieldLabel(field)}</FieldLabel>
                  <AdminCombobox
                    // `fontDisplay` is the one slot that can be absent.
                    value={layout[field] ?? ""}
                    onValueChange={(v) => setLayout({ ...layout, [field]: v || layout[field] })}
                    options={options.map((f) => ({ value: f.key, label: f.label }))}
                  />
                  <FieldError>{form.error(`layoutTokens.${field}`)}</FieldError>
                </Field>
              );
            })}
          </TabsContent>
        )}

        <TabsContent value="modes" className="grid grid-cols-1 gap-6 pt-4 md:grid-cols-2">
          <section className="card-hover flex flex-col gap-3 rounded-lg border p-4">
            <h3 className="text-sm font-semibold">{labels.lightSurface}</h3>
            {surfaceEditor(light, setLight, "light", "lightSurface")}
          </section>
          <section className="card-hover flex flex-col gap-3 rounded-lg border p-4">
            <h3 className="text-sm font-semibold">{labels.darkSurface}</h3>
            {surfaceEditor(dark, setDark, "dark", "darkSurface")}
          </section>
        </TabsContent>

        <TabsContent value="presets" className="flex flex-col gap-4 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-col gap-1">
              <p className="text-sm text-muted-foreground">{te("presetsIntro")}</p>
              {/* changes-50: which preset is live, said in words as well as
                  marked on its card — or that the palette is a custom one. */}
              <p className="text-sm font-medium">
                {activePreset
                  ? te("presetActiveNow", { name: activePreset.name })
                  : te("presetCustom")}
              </p>
            </div>
            <Button variant="outline" onClick={() => setPresetOpen(true)}>
              <Bookmark data-icon="inline-start" aria-hidden />
              {te("savePreset")}
            </Button>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {presets.map((preset) => (
              <div
                key={preset.key}
                aria-current={preset.isActive ? "true" : undefined}
                className={cn(
                  "card-hover flex flex-col gap-3 rounded-md border p-3",
                  // The live preset is unmistakable: a primary ring, not only
                  // a badge in the corner (changes-50).
                  preset.isActive && "border-primary bg-primary/5 ring-2 ring-primary",
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="flex items-center gap-1.5 text-sm font-medium">
                      {preset.isActive && (
                        <CircleCheck aria-hidden className="size-4 text-primary-interactive" />
                      )}
                      {preset.name}
                    </span>
                    {preset.description && (
                      <span className="text-xs text-muted-foreground">{preset.description}</span>
                    )}
                  </div>
                  {preset.isActive && (
                    <StatusBadge tone="success">{labels.activeBadge}</StatusBadge>
                  )}
                  {!preset.isActive && preset.isSystem && (
                    <StatusBadge tone="neutral">{te("presetBuiltIn")}</StatusBadge>
                  )}
                </div>
                {/* The page grounds the preset applies (light, then dark),
                    then its brand swatches — a built-in's white background
                    is shown, not implied. */}
                {(preset.lightBackground || preset.darkBackground) && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {(
                      [
                        [preset.lightBackground, labels.lightSurface],
                        [preset.darkBackground, labels.darkSurface],
                      ] as const
                    ).map(([color, label]) =>
                      color ? (
                        <span key={label} className="flex items-center gap-1.5">
                          <span
                            aria-hidden
                            className="size-4 shrink-0 rounded border"
                            style={{ backgroundColor: color }}
                          />
                          <span className="tracking-wide uppercase">{color}</span>
                        </span>
                      ) : null,
                    )}
                  </div>
                )}
                {preset.swatches.length > 0 && (
                  <div aria-hidden className="flex h-5 overflow-hidden rounded border">
                    {preset.swatches.map((color, i) => (
                      <span key={i} className="flex-1" style={{ backgroundColor: color }} />
                    ))}
                  </div>
                )}
                {!preset.isActive && (
                  <div className="flex items-center justify-end gap-2">
                    {!preset.isSystem && (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={pending}
                        onClick={() => setPresetToDelete(preset)}
                      >
                        <Trash2 data-icon="inline-start" aria-hidden />
                        {te("presetDelete")}
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pending}
                      onClick={() =>
                        run(() => activateThemeAction(preset.key, surface), {
                          successMessage: labels.saved,
                        })
                      }
                    >
                      {labels.activate}
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* changes-50: each suggestion is a collapsible TICKET — its title and
          severity on one line, the measurement and the fix inside — so a
          palette with several advisories reads as a list to work through
          rather than a wall of alerts. Blocking errors open by default. */}
      {issues.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">{labels.issues}</h3>
          <Accordion
            multiple
            defaultValue={issues.flatMap((issue, i) =>
              issue.severity === "error" ? [`issue-${i}`] : [],
            )}
            className="gap-2"
          >
            {issues.map((issue, i) => {
              const blocking = issue.severity === "error";
              const Icon = blocking ? CircleAlert : TriangleAlert;
              return (
                <AccordionItem
                  key={i}
                  value={`issue-${i}`}
                  className={cn(
                    "rounded-md border px-3",
                    blocking ? "border-destructive/40 bg-destructive/5" : "bg-warning/5",
                  )}
                >
                  <AccordionTrigger className="gap-2 py-2.5 text-start hover:no-underline">
                    <span className="flex min-w-0 flex-1 items-start gap-2">
                      <Icon
                        aria-hidden
                        className={cn(
                          "mt-0.5 size-4 shrink-0",
                          blocking ? "text-destructive-interactive" : "text-warning-interactive",
                        )}
                      />
                      <span className="min-w-0">
                        <span className="font-semibold">
                          {blocking ? labels.blockingError : labels.advisory}:
                        </span>{" "}
                        {issueTitle(issue)}
                      </span>
                    </span>
                    {applied.has(i) && (
                      <span className="shrink-0 text-xs font-medium">{te("applied")}</span>
                    )}
                  </AccordionTrigger>
                  <AccordionContent className="flex flex-col gap-2 ps-6 text-muted-foreground">
                    <p>{issueBody(issue)}</p>
                    {issue.palette === "darkOverride" ? (
                      <p>{te("override", { input: inputName(issue) })}</p>
                    ) : issue.suggestion ? (
                      <div className="flex flex-wrap items-center gap-3">
                        <span
                          aria-hidden
                          className="size-5 shrink-0 rounded border"
                          style={{ backgroundColor: issue.suggestion }}
                        />
                        <span className="min-w-0 flex-1">
                          {te(issue.kind === "linkText" ? "suggestionOptional" : "suggestion", {
                            input: inputName(issue),
                            where: where(issue),
                            current: issue.current,
                            suggestion: issue.suggestion,
                          })}
                          {issue.conflictsAcrossModes &&
                            ` ${te("conflict", { otherMode: issue.mode === "light" ? "dark" : "light" })}`}
                        </span>
                        {!applied.has(i) && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => applySuggestion(issue, i)}
                          >
                            <Wand2 data-icon="inline-start" aria-hidden />
                            {te("apply")}
                          </Button>
                        )}
                      </div>
                    ) : null}
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </div>
      )}

      {/* changes-08 #3: Save sits at the inline-END of its section, where every
      // other confirming action in the admin already sits (dialog footers,
      // "New X" buttons) — not at the start. */}
      {tabUsesSave && (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button variant="outline" onClick={() => setPresetOpen(true)}>
            <Bookmark data-icon="inline-start" aria-hidden />
            {te("savePreset")}
          </Button>
          <Button onClick={save} disabled={!dirty} loading={pending}>
            {labels.save}
          </Button>
        </div>
      )}

      <SavePresetDialog open={presetOpen} onOpenChange={setPresetOpen} tokens={presetPayload} />
      <ConfirmDialog
        open={presetToDelete !== null}
        onOpenChange={(next) => {
          if (!next) setPresetToDelete(null);
        }}
        title={te("presetDeleteTitle")}
        description={te("presetDeleteBody", { name: presetToDelete?.name ?? "" })}
        confirmLabel={te("presetDelete")}
        cancelLabel={te("cancel")}
        onConfirm={() => {
          const target = presetToDelete;
          setPresetToDelete(null);
          if (target) {
            run(() => deleteThemePresetAction(target.key), {
              successMessage: te("presetDeleted"),
            });
          }
        }}
      />
    </div>
  );
}

/**
 * "Save as preset" (changes-46). Saves what is IN the editor — unsaved edits
 * included — as a new, inactive preset: a way to keep an experiment without
 * putting it live. Applying it later is the Presets tab's Activate.
 */
function SavePresetDialog({
  open,
  onOpenChange,
  tokens,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tokens: {
    brandColors: BrandColors;
    lightSurface: SurfacePalette;
    darkSurface: SurfacePalette;
    darkBrandOverrides: BrandOverrides;
    layoutTokens: LayoutTokens;
  };
}) {
  const te = useTranslations("admin.themeEditor");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const payload = { ...tokens, name, description };
  const form = useFieldErrors(saveThemePresetSchema, payload);
  const { run, pending } = useServerAction();

  const close = () => {
    onOpenChange(false);
    setName("");
    setDescription("");
    form.reset();
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{te("savePresetTitle")}</DialogTitle>
          <DialogDescription>{te("savePresetDescription")}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <Field invalid={form.invalid("name")} required>
            <FieldLabel>{te("presetName")}</FieldLabel>
            <Input value={name} maxLength={100} onChange={(e) => setName(e.target.value)} />
            <FieldError>{form.error("name")}</FieldError>
          </Field>
          <Field invalid={form.invalid("description")}>
            <FieldLabel>{te("presetDescription")}</FieldLabel>
            <Textarea
              value={description}
              rows={3}
              maxLength={500}
              onChange={(e) => setDescription(e.target.value)}
            />
            <FieldError>{form.error("description")}</FieldError>
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={close} disabled={pending}>
            {te("cancel")}
          </Button>
          <Button
            loading={pending}
            onClick={() => {
              if (!form.validate()) return;
              run(() => saveThemePresetAction(payload), {
                successMessage: te("presetSaved"),
                onDone: close,
              });
            }}
          >
            {te("savePreset")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

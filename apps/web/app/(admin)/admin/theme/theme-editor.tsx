"use client";

// Theme editor client shell (Module 09 core). Tabs mirror the engine:
// Colors & Branding (BRAND_FIELD_REGISTRY-driven), Layout & Display,
// Theme Modes side-by-side, Presets, Logos & Favicons (changes-02, plan.md
// Module 09: BrandAsset upload). validateTheme runs SERVER-side in
// saveThemeAction — this component renders the returned issues verbatim;
// blocking errors mean the save was refused (SKILL.md). Live preview
// iframe is the remaining deferred polish.
import { useMemo, useState } from "react";
// Type-only imports — erased at compile time, so no next/cache pulls into
// the client bundle.
import type {
  BrandColors,
  BrandOverrides,
  ContrastIssue,
  LayoutTokens,
  SurfacePalette,
} from "@repo/theme";
import { saveThemeSchema } from "@repo/contracts";
import { humanizeKey } from "@repo/utils";
import { Alert, AlertDescription, AlertTitle } from "@repo/ui/components/alert";
import { Button } from "@repo/ui/components/button";
import { Field, FieldError, FieldLabel } from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/ui/components/tabs";
import { activateThemeAction, saveThemeAction } from "../_actions/admin-actions.ts";
import { clearBrandAssetAction, setBrandAssetAction } from "../_actions/media-actions.ts";
import { ImageUploadField, type ImageUploadLabels } from "../_components/image-upload-field.tsx";
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
  issues: string;
  blockingError: string;
  advisory: string;
  derivedPreview: string;
  saveBlocked: string;
  needsRatio: string;
  hexValue: string;
  fieldLabels: Record<string, string>;
  logos: string;
  logoLight: string;
  logoDark: string;
  favicon: string;
  upload: ImageUploadLabels;
}

export interface BrandAssetUrls {
  logo_light: string | null;
  logo_dark: string | null;
  favicon: string | null;
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

export function ThemeEditor({
  themeKey,
  initial,
  derived,
  presets,
  brandAssets,
  brandFields,
  fonts,
  labels,
}: {
  themeKey: string;
  initial: {
    brand: BrandColors;
    light: SurfacePalette;
    dark: SurfacePalette;
    overrides: BrandOverrides;
    layout: LayoutTokens;
  };
  derived: { interactive: string; interactiveDark: string };
  presets: { key: string; name: string; isActive: boolean; scope: string }[];
  brandAssets: BrandAssetUrls;
  brandFields: string[];
  fonts: { key: string; label: string; category: string }[];
  labels: Labels;
}) {
  const [brand, setBrand] = useState(initial.brand);
  const [light, setLight] = useState(initial.light);
  const [dark, setDark] = useState(initial.dark);
  const [layout, setLayout] = useState(initial.layout);
  const [issues, setIssues] = useState<ContrastIssue[]>([]);
  const [logos, setLogos] = useState(brandAssets);
  const { run, pending } = useServerAction();
  const logoAction = useServerAction();

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
        if (!result.saved) throw new Error(labels.saveBlocked);
      },
      { successMessage: labels.saved },
    );
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
      <Tabs defaultValue="brand">
        <TabsList>
          <TabsTrigger value="brand">{labels.brand}</TabsTrigger>
          {THEME_LAYOUT_TAB_ENABLED && <TabsTrigger value="layout">{labels.layout}</TabsTrigger>}
          <TabsTrigger value="modes">{labels.modes}</TabsTrigger>
          <TabsTrigger value="presets">{labels.presets}</TabsTrigger>
          <TabsTrigger value="logos">{labels.logos}</TabsTrigger>
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
            {(["fontSans", "fontMono"] as const).map((field) => {
              const options = fonts.filter((f) =>
                field === "fontSans" ? f.category === "sans" : f.category === "mono",
              );
              return (
                <Field key={field} invalid={form.invalid(`layoutTokens.${field}`)} required>
                  <FieldLabel>{fieldLabel(field)}</FieldLabel>
                  <AdminCombobox
                    value={layout[field]}
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

        <TabsContent
          value="presets"
          className="grid grid-cols-1 gap-3 pt-4 md:grid-cols-2 xl:grid-cols-3"
        >
          {presets.map((preset) => (
            <div
              key={preset.key}
              className="card-hover flex items-center gap-3 rounded-md border p-3"
            >
              <div className="flex flex-1 flex-col">
                <span className="text-sm font-medium">{preset.name}</span>
                <span className="text-xs text-muted-foreground">
                  {preset.key} · {preset.scope}
                </span>
              </div>
              {preset.isActive ? (
                <StatusBadge tone="success">{labels.activeBadge}</StatusBadge>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() =>
                    run(() => activateThemeAction(preset.key), { successMessage: labels.saved })
                  }
                >
                  {labels.activate}
                </Button>
              )}
            </div>
          ))}
        </TabsContent>

        <TabsContent
          value="logos"
          className="grid grid-cols-1 items-start gap-6 pt-4 md:grid-cols-2 xl:grid-cols-3"
        >
          {(
            [
              ["logo_light", labels.logoLight, "brand"],
              ["logo_dark", labels.logoDark, "brand"],
              ["favicon", labels.favicon, "brand"],
            ] as const
          ).map(([key, label]) => (
            // Each upload saves on its own through its own action, outside
            // the theme payload — so it carries no `error` from `form`.
            <ImageUploadField
              key={key}
              label={label}
              value={logos[key]}
              purpose="brand"
              category="brand"
              sourceType="BRAND"
              labels={labels.upload}
              disabled={logoAction.pending}
              onChange={(next) => {
                setLogos((current) => ({ ...current, [key]: next?.url ?? null }));
                logoAction.run(
                  () =>
                    next
                      ? setBrandAssetAction({ key, mediaAssetId: next.id })
                      : clearBrandAssetAction(key),
                  { successMessage: labels.saved, skipRefresh: true },
                );
              }}
            />
          ))}
        </TabsContent>
      </Tabs>

      {issues.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">{labels.issues}</h3>
          {issues.map((issue, i) => (
            <Alert key={i} variant={issue.severity === "error" ? "destructive" : "warning"}>
              <AlertTitle>
                [{issue.severity === "error" ? labels.blockingError : labels.advisory}]{" "}
                {issue.label} ({issue.mode}) — {issue.ratio}:1, {labels.needsRatio} {issue.required}
                :1
              </AlertTitle>
              {issue.remedy && <AlertDescription>{issue.remedy}</AlertDescription>}
            </Alert>
          ))}
        </div>
      )}

      {/* changes-08 #3: Save sits at the inline-END of its section, where every
      // other confirming action in the admin already sits (dialog footers,
      // "New X" buttons) — not at the start. */}
      <Button onClick={save} disabled={!dirty} loading={pending} className="self-end">
        {labels.save}
      </Button>
    </div>
  );
}

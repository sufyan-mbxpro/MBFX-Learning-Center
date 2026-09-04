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
import { Alert, AlertDescription, AlertTitle } from "@repo/ui/components/alert";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/ui/components/tabs";
import { activateThemeAction, saveThemeAction } from "../_actions/admin-actions.ts";
import { clearBrandAssetAction, setBrandAssetAction } from "../_actions/media-actions.ts";
import { ImageUploadField, type ImageUploadLabels } from "../_components/image-upload-field.tsx";
import { StatusBadge } from "../_components/status-badge.tsx";
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

// Registry token ids ("primaryHover") shown as words ("Primary Hover") when
// no catalog label exists — the registry is code-defined, so the id is the
// canonical name.
function humanize(field: string): string {
  const spaced = field.replace(/([A-Z])/g, " $1");
  return (spaced[0]?.toUpperCase() ?? "") + spaced.slice(1);
}

const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}$/;

function ColorField({
  id,
  label,
  hexLabel,
  value,
  onChange,
}: {
  id: string;
  label: string;
  hexLabel: string;
  value: string;
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

  return (
    <div className="flex items-center gap-3">
      <Input
        id={id}
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-14 p-1"
      />
      <Label htmlFor={id} className="flex-1">
        {label}
      </Label>
      <Input
        aria-label={`${label} ${hexLabel}`}
        value={draft}
        onChange={(e) => commit(e.target.value)}
        onBlur={() => setDraft(value)}
        maxLength={7}
        className="w-24 font-mono text-xs"
      />
    </div>
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

  const fieldLabel = (field: string) => labels.fieldLabels[field] ?? humanize(field);

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

  const save = () =>
    run(
      async () => {
        const result = await saveThemeAction({
          themeKey,
          brandColors: brand,
          lightSurface: light,
          darkSurface: dark,
          darkBrandOverrides: initial.overrides,
          layoutTokens: layout,
        });
        setIssues(result.issues);
        if (!result.saved) throw new Error(labels.saveBlocked);
      },
      { successMessage: labels.saved },
    );

  const surfaceEditor = (
    palette: SurfacePalette,
    setPalette: (p: SurfacePalette) => void,
    prefix: string,
  ) => (
    <div className="flex flex-col gap-2.5">
      {Object.entries(palette).map(([field, value]) => (
        <ColorField
          key={field}
          id={`${prefix}-${field}`}
          label={fieldLabel(field)}
          hexLabel={labels.hexValue}
          value={value}
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
          <TabsTrigger value="layout">{labels.layout}</TabsTrigger>
          <TabsTrigger value="modes">{labels.modes}</TabsTrigger>
          <TabsTrigger value="presets">{labels.presets}</TabsTrigger>
          <TabsTrigger value="logos">{labels.logos}</TabsTrigger>
        </TabsList>

        <TabsContent value="brand" className="flex max-w-md flex-col gap-3 pt-4">
          {brandFields.map((field) => (
            <ColorField
              key={field}
              id={`brand-${field}`}
              label={fieldLabel(field)}
              hexLabel={labels.hexValue}
              value={brand[field as keyof BrandColors]}
              onChange={(v) => setBrand({ ...brand, [field]: v })}
            />
          ))}
          <div className="mt-2 rounded-md border p-3">
            <p className="mb-2 text-sm font-medium">{labels.derivedPreview}</p>
            <div className="flex flex-col gap-1.5">
              {[derived.interactive, derived.interactiveDark].map((color, i) => (
                <span key={i} className="flex items-center gap-2 text-xs">
                  <span
                    aria-hidden
                    className="size-5 shrink-0 rounded border"
                    style={{ backgroundColor: color }}
                  />
                  <code className="text-muted-foreground">{color}</code>
                </span>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="layout" className="flex max-w-md flex-col gap-3 pt-4">
          {(["radiusBase", "containerWidth", "baseFontSize"] as const).map((field) => (
            <div key={field} className="flex items-center gap-3">
              <Label htmlFor={`layout-${field}`} className="w-36">
                {fieldLabel(field)}
              </Label>
              <Input
                id={`layout-${field}`}
                value={layout[field]}
                onChange={(e) => setLayout({ ...layout, [field]: e.target.value })}
                className="max-w-40"
              />
            </div>
          ))}
          {(["fontSans", "fontMono"] as const).map((field) => {
            const options = fonts.filter((f) =>
              field === "fontSans" ? f.category === "sans" : f.category === "mono",
            );
            return (
              <div key={field} className="flex items-center gap-3">
                <Label htmlFor={`layout-${field}`} className="w-36">
                  {fieldLabel(field)}
                </Label>
                <Select
                  value={layout[field]}
                  onValueChange={(v) =>
                    setLayout({ ...layout, [field]: (v as string) || layout[field] })
                  }
                >
                  <SelectTrigger id={`layout-${field}`} className="min-w-40">
                    <SelectValue>
                      {options.find((f) => f.key === layout[field])?.label ?? layout[field]}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {options.map((f) => (
                      <SelectItem key={f.key} value={f.key}>
                        {f.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            );
          })}
        </TabsContent>

        <TabsContent value="modes" className="grid gap-6 pt-4 md:grid-cols-2">
          <section className="card-hover flex flex-col gap-3 rounded-lg border p-4">
            <h3 className="text-sm font-semibold">{labels.lightSurface}</h3>
            {surfaceEditor(light, setLight, "light")}
          </section>
          <section className="card-hover flex flex-col gap-3 rounded-lg border p-4">
            <h3 className="text-sm font-semibold">{labels.darkSurface}</h3>
            {surfaceEditor(dark, setDark, "dark")}
          </section>
        </TabsContent>

        <TabsContent value="presets" className="flex max-w-md flex-col gap-3 pt-4">
          {presets.map((preset) => (
            <div key={preset.key} className="card-hover flex items-center gap-3 rounded-md border p-3">
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

        <TabsContent value="logos" className="flex max-w-md flex-col gap-4 pt-4">
          {(
            [
              ["logo_light", labels.logoLight, "brand"],
              ["logo_dark", labels.logoDark, "brand"],
              ["favicon", labels.favicon, "brand"],
            ] as const
          ).map(([key, label]) => (
            <ImageUploadField
              key={key}
              id={`brand-asset-${key}`}
              label={label}
              value={logos[key]}
              purpose="brand"
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

      <Button onClick={save} disabled={pending || !dirty} className="self-start">
        {labels.save}
      </Button>
    </div>
  );
}

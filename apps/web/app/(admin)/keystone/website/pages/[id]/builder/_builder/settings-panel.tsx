"use client";

// The per-block settings panel (plan §8): General (from `fields`) · Style ·
// Motion · Visibility · Responsive. A block-level "SEO" tab is NOT built —
// SEO lives at the page level (already shipped, Phase 1) and no `fields`
// entry on any block declares per-block SEO data, so there is nothing for
// a sixth tab to edit yet; a named scope cut, not an oversight.
import type { FeatureVisibilityInput, StoredNode } from "@repo/contracts";
import { Button } from "@repo/ui/components/button";
import { Checkbox } from "@repo/ui/components/checkbox";
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
import { FieldControl, type FieldControlLabels } from "./field-control.tsx";
import { MotionEditor, StyleEditor, type StyleEditorLabels } from "./style-editor.tsx";
import type { SerializedBlockDefinition, StylePresetSummary } from "./types.ts";
import { readResponsiveValue, type Device } from "@repo/contracts";

export interface SettingsPanelLabels {
  tabGeneral: string;
  tabStyle: string;
  tabMotion: string;
  tabVisibility: string;
  tabResponsive: string;
  labelField: string;
  anchorField: string;
  visibilityField: string;
  requiresFeatureField: string;
  visibilityPublic: string;
  visibilityAuthenticated: string;
  visibilityPremium: string;
  visibilityAdmin: string;
  deviceMobile: string;
  deviceTablet: string;
  deviceDesktop: string;
  hide: string;
  fieldControl: FieldControlLabels;
  style: StyleEditorLabels;
  saveAsStyle: string;
  saveAsTemplate: string;
}

const VISIBILITY_OPTIONS: FeatureVisibilityInput[] = [
  "PUBLIC",
  "AUTHENTICATED",
  "PREMIUM",
  "ADMIN",
];
const DEVICES: Device[] = ["mobile", "tablet", "desktop"];

export function SettingsPanel({
  node,
  definition,
  locale,
  defaultLocale,
  onUpdate,
  pages,
  stylePresets,
  onSaveAsStyle,
  onSaveAsTemplate,
  labels,
}: {
  node: StoredNode;
  definition: SerializedBlockDefinition;
  locale: string;
  defaultLocale: string;
  onUpdate: (updater: (node: StoredNode) => StoredNode) => void;
  pages: { id: string; title: string }[];
  stylePresets: StylePresetSummary[];
  onSaveAsStyle: () => void;
  onSaveAsTemplate: () => void;
  labels: SettingsPanelLabels;
}) {
  const isTranslating = locale !== defaultLocale;
  const props = (node.props ?? {}) as Record<string, unknown>;
  const translationForLocale = (node.translations?.[locale] ?? {}) as Record<string, unknown>;

  function fieldValue(path: string, translatable: boolean | undefined): unknown {
    if (isTranslating && translatable) {
      return path in translationForLocale ? translationForLocale[path] : props[path];
    }
    return props[path];
  }

  function setFieldValue(path: string, translatable: boolean | undefined, value: unknown) {
    if (isTranslating && translatable) {
      onUpdate((current) => ({
        ...current,
        translations: {
          ...current.translations,
          [locale]: { ...(current.translations?.[locale] ?? {}), [path]: value },
        },
      }));
      return;
    }
    onUpdate((current) => ({ ...current, props: { ...(current.props as object), [path]: value } }));
  }

  const styleKeys = definition.supports.style ?? [];
  const showStyleTab = styleKeys.length > 0;
  const showMotionTab = definition.supports.motion ?? false;
  const showVisibilityTab = definition.supports.visibility ?? false;
  const showResponsiveTab = definition.responsive.length > 0;

  return (
    <Tabs defaultValue="general" className="flex flex-col gap-3">
      <TabsList>
        <TabsTrigger value="general">{labels.tabGeneral}</TabsTrigger>
        {showStyleTab && <TabsTrigger value="style">{labels.tabStyle}</TabsTrigger>}
        {showMotionTab && <TabsTrigger value="motion">{labels.tabMotion}</TabsTrigger>}
        {showVisibilityTab && <TabsTrigger value="visibility">{labels.tabVisibility}</TabsTrigger>}
        {showResponsiveTab && <TabsTrigger value="responsive">{labels.tabResponsive}</TabsTrigger>}
      </TabsList>

      <TabsContent value="general" className="flex flex-col gap-3">
        {!isTranslating && (
          <>
            <div className="flex flex-col gap-1.5">
              <Label>{labels.labelField}</Label>
              <Input
                value={node.label ?? ""}
                onChange={(e) =>
                  onUpdate((current) => ({ ...current, label: e.target.value || undefined }))
                }
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{labels.anchorField}</Label>
              <Input
                value={node.anchor ?? ""}
                onChange={(e) =>
                  onUpdate((current) => ({ ...current, anchor: e.target.value || undefined }))
                }
              />
            </div>
          </>
        )}
        {definition.fields
          .filter((field) => !isTranslating || field.translatable)
          .map((field) => (
            <div key={field.path} className="flex flex-col gap-1.5">
              <Label>{field.label}</Label>
              <FieldControl
                field={field}
                value={fieldValue(field.path, field.translatable)}
                onChange={(next) => setFieldValue(field.path, field.translatable, next)}
                pages={pages}
                labels={labels.fieldControl}
              />
              {field.help && <p className="text-xs text-muted-foreground">{field.help}</p>}
            </div>
          ))}
        {!isTranslating && (
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={onSaveAsStyle}>
              {labels.saveAsStyle}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={onSaveAsTemplate}>
              {labels.saveAsTemplate}
            </Button>
          </div>
        )}
      </TabsContent>

      {showStyleTab && (
        <TabsContent value="style">
          <StyleEditor
            styleKeys={styleKeys}
            overrides={node.style?.overrides ?? {}}
            onChangeOverrides={(overrides) =>
              onUpdate((current) => ({ ...current, style: { ...current.style, overrides } }))
            }
            presetId={node.style?.presetId}
            presets={stylePresets}
            onChangePresetId={(presetId) =>
              onUpdate((current) => ({ ...current, style: { ...current.style, presetId } }))
            }
            labels={labels.style}
          />
        </TabsContent>
      )}

      {showMotionTab && (
        <TabsContent value="motion">
          <MotionEditor
            value={node.motion ?? {}}
            onChange={(motion) => onUpdate((current) => ({ ...current, motion }))}
            labels={labels.style}
          />
        </TabsContent>
      )}

      {showVisibilityTab && (
        <TabsContent value="visibility" className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>{labels.visibilityField}</Label>
            <Select
              value={node.visibility ?? "PUBLIC"}
              onValueChange={(next) =>
                next &&
                onUpdate((current) => ({
                  ...current,
                  visibility: next as FeatureVisibilityInput,
                }))
              }
            >
              <SelectTrigger>
                <SelectValue>
                  {
                    {
                      PUBLIC: labels.visibilityPublic,
                      AUTHENTICATED: labels.visibilityAuthenticated,
                      PREMIUM: labels.visibilityPremium,
                      ADMIN: labels.visibilityAdmin,
                    }[node.visibility ?? "PUBLIC"]
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {VISIBILITY_OPTIONS.map((v) => (
                  <SelectItem key={v} value={v}>
                    {
                      {
                        PUBLIC: labels.visibilityPublic,
                        AUTHENTICATED: labels.visibilityAuthenticated,
                        PREMIUM: labels.visibilityPremium,
                        ADMIN: labels.visibilityAdmin,
                      }[v]
                    }
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{labels.requiresFeatureField}</Label>
            <Input
              value={node.requiresFeature ?? ""}
              onChange={(e) =>
                onUpdate((current) => ({
                  ...current,
                  requiresFeature: e.target.value || undefined,
                }))
              }
            />
          </div>
        </TabsContent>
      )}

      {showResponsiveTab && (
        <TabsContent value="responsive" className="flex flex-col gap-4">
          {DEVICES.map((device) => (
            <div key={device} className="flex flex-col gap-2 rounded-md border p-3">
              <Label className="text-xs uppercase text-muted-foreground">
                {
                  {
                    mobile: labels.deviceMobile,
                    tablet: labels.deviceTablet,
                    desktop: labels.deviceDesktop,
                  }[device]
                }
              </Label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={(node.responsive?.hiddenOn ?? []).includes(device)}
                  onCheckedChange={(checked) =>
                    onUpdate((current) => {
                      const next = new Set(current.responsive?.hiddenOn ?? []);
                      if (checked === true) next.add(device);
                      else next.delete(device);
                      return { ...current, responsive: { hiddenOn: [...next] } };
                    })
                  }
                />
                {labels.hide}
              </label>
              {definition.responsive.map((path) => {
                const field = definition.fields.find((f) => f.path === path);
                if (!field) return null;
                const breakpoint = device === "mobile" ? "base" : device === "tablet" ? "md" : "lg";
                const current = readResponsiveValue(props[path] as never, breakpoint);
                return (
                  <div key={path} className="flex flex-col gap-1.5">
                    <Label>{field.label}</Label>
                    <FieldControl
                      field={field}
                      value={current}
                      onChange={(next) => {
                        const base = props[path];
                        const existing =
                          typeof base === "object" && base !== null && "base" in base
                            ? (base as { base: unknown; md?: unknown; lg?: unknown })
                            : { base };
                        setFieldValue(path, false, { ...existing, [breakpoint]: next });
                      }}
                      pages={pages}
                      labels={labels.fieldControl}
                    />
                  </div>
                );
              })}
            </div>
          ))}
        </TabsContent>
      )}
    </Tabs>
  );
}

"use client";

// Style + Motion tabs (ADR-024 §1-2, ADR-032 §2) — every control is a
// bounded-enum Select, matching styleChoicesSchema/motionChoicesSchema
// exactly. "Use style" sets `style.presetId` (Linked, ADR-033); the
// per-key overrides below it apply ON TOP of the preset per the renderer's
// own precedent (ADR-033 §"presetId + overrides both apply").
import type { Background, MotionChoices, StyleChoices, StyleKey } from "@repo/contracts";
import { Label } from "@repo/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import { MediaPickerControl, type MediaPickerLabels } from "./media-picker.tsx";
import type { StylePresetSummary } from "./types.ts";

const INHERIT = "__inherit__";

function EnumField<T extends string>({
  label,
  value,
  options,
  onChange,
  inheritLabel,
}: {
  label: string;
  value: T | undefined;
  options: readonly T[];
  onChange: (next: T | undefined) => void;
  inheritLabel: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      <Select
        value={value ?? INHERIT}
        onValueChange={(next) => onChange(!next || next === INHERIT ? undefined : (next as T))}
      >
        <SelectTrigger>
          <SelectValue>{value ?? inheritLabel}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={INHERIT}>{inheritLabel}</SelectItem>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export interface StyleEditorLabels {
  useStyle: string;
  useStyleNone: string;
  inherit: string;
  background: string;
  backgroundNone: string;
  backgroundToken: string;
  backgroundGradient: string;
  backgroundImage: string;
  backgroundVideo: string;
  overlayTone: string;
  overlayStrength: string;
  gradientFrom: string;
  gradientTo: string;
  textTone: string;
  padding: string;
  gap: string;
  radius: string;
  shadow: string;
  border: string;
  width: string;
  entrance: string;
  hover: string;
  media: MediaPickerLabels;
}

const OPTIONS = {
  backgroundToken: ["none", "surface-1", "surface-2", "primary", "secondary", "accent"] as const,
  brandToken: ["primary", "secondary", "accent"] as const,
  gradientDirection: ["to-b", "to-r", "to-br", "radial"] as const,
  overlayTone: ["none", "light", "dark", "brand"] as const,
  overlayStrength: ["sm", "md", "lg"] as const,
  textTone: ["default", "muted", "on-primary", "on-image"] as const,
  padding: ["none", "sm", "md", "lg", "xl"] as const,
  gap: ["none", "sm", "md", "lg"] as const,
  radius: ["none", "sm", "md", "lg"] as const,
  shadow: ["none", "sm", "md", "lg"] as const,
  border: ["none", "hairline", "strong"] as const,
  width: ["narrow", "default", "wide", "full"] as const,
  entrance: ["none", "fade", "fade-up", "stagger"] as const,
  hover: ["none", "lift", "zoom"] as const,
};

function BackgroundEditor({
  value,
  onChange,
  labels,
}: {
  value: Background | undefined;
  onChange: (next: Background | undefined) => void;
  labels: StyleEditorLabels;
}) {
  const kind = value?.kind ?? "__none__";
  return (
    <div className="flex flex-col gap-2 rounded-md border p-3">
      <div className="flex flex-col gap-1.5">
        <Label>{labels.background}</Label>
        <Select
          value={kind}
          onValueChange={(next) => {
            if (!next || next === "__none__") return onChange(undefined);
            if (next === "token") onChange({ kind: "token", token: "none" });
            else if (next === "gradient") {
              onChange({ kind: "gradient", from: "primary", to: "secondary", direction: "to-b" });
            } else if (next === "image") {
              onChange({
                kind: "image",
                assetId: "",
                fit: "cover",
                position: "center",
                overlay: { tone: "none", strength: "sm" },
              });
            } else if (next === "video") {
              onChange({
                kind: "video",
                assetId: "",
                posterAssetId: "",
                overlay: { tone: "none", strength: "sm" },
              });
            }
          }}
        >
          <SelectTrigger>
            <SelectValue>
              {
                {
                  __none__: labels.backgroundNone,
                  token: labels.backgroundToken,
                  gradient: labels.backgroundGradient,
                  image: labels.backgroundImage,
                  video: labels.backgroundVideo,
                }[kind]
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">{labels.backgroundNone}</SelectItem>
            <SelectItem value="token">{labels.backgroundToken}</SelectItem>
            <SelectItem value="gradient">{labels.backgroundGradient}</SelectItem>
            <SelectItem value="image">{labels.backgroundImage}</SelectItem>
            <SelectItem value="video">{labels.backgroundVideo}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {value?.kind === "token" && (
        <EnumField
          label={labels.background}
          value={value.token}
          options={OPTIONS.backgroundToken}
          onChange={(v) => v && onChange({ kind: "token", token: v })}
          inheritLabel={labels.inherit}
        />
      )}

      {value?.kind === "gradient" && (
        <>
          <EnumField
            label={labels.gradientFrom}
            value={value.from}
            options={OPTIONS.brandToken}
            onChange={(v) => v && onChange({ ...value, from: v })}
            inheritLabel={labels.inherit}
          />
          <EnumField
            label={labels.gradientTo}
            value={value.to}
            options={OPTIONS.brandToken}
            onChange={(v) => v && onChange({ ...value, to: v })}
            inheritLabel={labels.inherit}
          />
          <EnumField
            label={labels.background}
            value={value.direction}
            options={OPTIONS.gradientDirection}
            onChange={(v) => v && onChange({ ...value, direction: v })}
            inheritLabel={labels.inherit}
          />
        </>
      )}

      {(value?.kind === "image" || value?.kind === "video") && (
        <>
          <div className="flex flex-col gap-1.5">
            <Label>{labels.background}</Label>
            <MediaPickerControl
              value={value.assetId}
              onChange={(assetId) => onChange({ ...value, assetId })}
              labels={labels.media}
            />
          </div>
          {value.kind === "video" && (
            <div className="flex flex-col gap-1.5">
              <Label>{labels.backgroundVideo}</Label>
              <MediaPickerControl
                value={value.posterAssetId}
                onChange={(posterAssetId) => onChange({ ...value, posterAssetId })}
                labels={labels.media}
              />
            </div>
          )}
          <EnumField
            label={labels.overlayTone}
            value={value.overlay.tone}
            options={OPTIONS.overlayTone}
            onChange={(v) => v && onChange({ ...value, overlay: { ...value.overlay, tone: v } })}
            inheritLabel={labels.inherit}
          />
          <EnumField
            label={labels.overlayStrength}
            value={value.overlay.strength}
            options={OPTIONS.overlayStrength}
            onChange={(v) =>
              v && onChange({ ...value, overlay: { ...value.overlay, strength: v } })
            }
            inheritLabel={labels.inherit}
          />
        </>
      )}
    </div>
  );
}

export function StyleEditor({
  styleKeys,
  overrides,
  onChangeOverrides,
  presetId,
  presets,
  onChangePresetId,
  labels,
}: {
  styleKeys: StyleKey[];
  overrides: StyleChoices;
  onChangeOverrides: (next: StyleChoices) => void;
  presetId: string | undefined;
  presets: StylePresetSummary[];
  onChangePresetId: (next: string | undefined) => void;
  labels: StyleEditorLabels;
}) {
  function setKey<K extends keyof StyleChoices>(key: K, value: StyleChoices[K]) {
    const next = { ...overrides };
    if (value === undefined) delete next[key];
    else next[key] = value;
    onChangeOverrides(next);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label>{labels.useStyle}</Label>
        <Select
          value={presetId ?? INHERIT}
          onValueChange={(next) => onChangePresetId(!next || next === INHERIT ? undefined : next)}
        >
          <SelectTrigger>
            <SelectValue>
              {presets.find((p) => p.id === presetId)?.name ?? labels.useStyleNone}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={INHERIT}>{labels.useStyleNone}</SelectItem>
            {presets.map((preset) => (
              <SelectItem key={preset.id} value={preset.id}>
                {preset.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {styleKeys.includes("background") && (
        <BackgroundEditor
          value={overrides.background}
          onChange={(v) => setKey("background", v)}
          labels={labels}
        />
      )}
      {styleKeys.includes("textTone") && (
        <EnumField
          label={labels.textTone}
          value={overrides.textTone}
          options={OPTIONS.textTone}
          onChange={(v) => setKey("textTone", v)}
          inheritLabel={labels.inherit}
        />
      )}
      {styleKeys.includes("padding") && (
        <EnumField
          label={labels.padding}
          value={overrides.padding}
          options={OPTIONS.padding}
          onChange={(v) => setKey("padding", v)}
          inheritLabel={labels.inherit}
        />
      )}
      {styleKeys.includes("gap") && (
        <EnumField
          label={labels.gap}
          value={overrides.gap}
          options={OPTIONS.gap}
          onChange={(v) => setKey("gap", v)}
          inheritLabel={labels.inherit}
        />
      )}
      {styleKeys.includes("radius") && (
        <EnumField
          label={labels.radius}
          value={overrides.radius}
          options={OPTIONS.radius}
          onChange={(v) => setKey("radius", v)}
          inheritLabel={labels.inherit}
        />
      )}
      {styleKeys.includes("shadow") && (
        <EnumField
          label={labels.shadow}
          value={overrides.shadow}
          options={OPTIONS.shadow}
          onChange={(v) => setKey("shadow", v)}
          inheritLabel={labels.inherit}
        />
      )}
      {styleKeys.includes("border") && (
        <EnumField
          label={labels.border}
          value={overrides.border}
          options={OPTIONS.border}
          onChange={(v) => setKey("border", v)}
          inheritLabel={labels.inherit}
        />
      )}
      {styleKeys.includes("width") && (
        <EnumField
          label={labels.width}
          value={overrides.width}
          options={OPTIONS.width}
          onChange={(v) => setKey("width", v)}
          inheritLabel={labels.inherit}
        />
      )}
    </div>
  );
}

export function MotionEditor({
  value,
  onChange,
  labels,
}: {
  value: MotionChoices;
  onChange: (next: MotionChoices) => void;
  labels: StyleEditorLabels;
}) {
  return (
    <div className="flex flex-col gap-3">
      <EnumField
        label={labels.entrance}
        value={value.entrance}
        options={OPTIONS.entrance}
        onChange={(v) => onChange({ ...value, entrance: v })}
        inheritLabel={labels.inherit}
      />
      <EnumField
        label={labels.hover}
        value={value.hover}
        options={OPTIONS.hover}
        onChange={(v) => onChange({ ...value, hover: v })}
        inheritLabel={labels.inherit}
      />
    </div>
  );
}

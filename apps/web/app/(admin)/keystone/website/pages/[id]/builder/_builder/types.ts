// Shared client-side shapes for the composer (PR 3.3). These are plain,
// JSON-serializable subsets of the server's richer rows/definitions — safe
// to pass from the server page.tsx to client components as props.
//
// Every catalog key is resolved to its translated string SERVER-SIDE
// (page.tsx) before this crosses into a Client Component: a Server
// Component may only pass plain data or a "use server" action as a prop,
// never an ordinary function like next-intl's `t` — the composer's own
// block/field vocabulary is a small, build-time-known set, so pre-
// resolving it here removes the need for a client-side translate call
// entirely (found the hard way: Next.js refuses to serialize a bare
// function prop and errors at render time).
import type { MotionChoices, StyleChoices, StyleKey } from "@repo/contracts";

export interface ResolvedFieldOption {
  value: string;
  label: string;
}

export interface ResolvedEditorField {
  path: string;
  kind:
    | "text"
    | "textarea"
    | "richText"
    | "number"
    | "boolean"
    | "select"
    | "link"
    | "media"
    | "cardTemplate"
    | "stylePreset"
    | "color-token"
    | "json";
  label: string;
  help?: string;
  options?: ResolvedFieldOption[];
  translatable?: boolean;
}

export interface SerializedBlockDefinition {
  type: string;
  version: number;
  label: string;
  category: "layout" | "content" | "collection" | "detail" | "data" | "marketing";
  defaults: unknown;
  fields: ResolvedEditorField[];
  translatable: string[];
  responsive: string[];
  links: string[];
  supports: { style?: StyleKey[]; motion?: boolean; visibility?: boolean; children?: boolean };
}

export interface StylePresetSummary {
  id: string;
  key: string;
  name: string;
  config: { style?: StyleChoices; motion?: MotionChoices };
}

export interface SectionTemplateSummary {
  id: string;
  key: string;
  name: string;
  kind: "SECTION" | "BLOCK";
  layout: unknown;
}

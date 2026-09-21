// The shape of `defaults.json` — what `seed:export-defaults` writes from a
// running install and `seed:live` applies to a fresh one (ADR-144 §1).
//
// It holds NO secret. The three sealed columns (security.md #10) are never
// read by the exporter, and `assertNotSecret` refuses any setting key that
// looks like one — a new `*.apiKey` setting added later fails the export
// instead of being committed.

/** A string value that referred to an uploaded file, replaced by the committed copy. */
export interface FileRef {
  $file: string;
}

export interface DefaultsFile {
  exportedAt: string;
  theme: {
    key: string;
    name: string;
    description: string | null;
    brandColors: unknown;
    lightSurface: unknown;
    darkSurface: unknown;
    darkBrandOverrides: unknown;
    layoutTokens: unknown;
    defaultMode: string;
  } | null;
  brandAssets: {
    key: string;
    altText: string | null;
    /** A committed file under `media/` to upload, or a static site path to keep. */
    file?: string;
    url?: string;
  }[];
  /** Setting key → value; a `/uploads/…` string is a `FileRef`. */
  settings: Record<string, unknown>;
  flags: Record<string, boolean>;
  market: {
    driver: string;
    baseUrl: string | null;
    refreshSeconds: number;
    staleSeconds: number;
    isEnabled: boolean;
  } | null;
  ai: {
    kind: string;
    baseUrl: string | null;
    models: {
      modelId: string;
      label: string;
      inputPricePerMTok: number;
      outputPricePerMTok: number;
      cachedInputPricePerMTok: number | null;
      maxOutputTokens: number;
      supportsVision: boolean;
    }[];
    features: {
      key: string;
      isEnabled: boolean;
      maxOutputTokens: number | null;
      extraInstructions: string | null;
    }[];
  } | null;
}

// Matched against the key's LAST segment, whole-word: `ai.maxTokensPerRequest` is a
// limit, not a token, and a substring match refused it.
const SECRET_KEY =
  /^(password|passwd|secret|api[_-]?key|access[_-]?token|token|cipher|credentials?|private[_-]?key)$/i;

export function assertNotSecret(key: string): void {
  const last = key.split(".").pop() ?? key;
  if (SECRET_KEY.test(last) || /(password|secret|cipher)/i.test(key)) {
    throw new Error(
      `Refusing to export "${key}": it looks like a secret. Secrets live in env or in ` +
        "a sealed column (security.md #10), never in a committed file.",
    );
  }
}

export function isFileRef(value: unknown): value is FileRef {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { $file?: unknown }).$file === "string"
  );
}

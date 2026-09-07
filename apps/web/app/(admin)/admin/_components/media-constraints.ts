// Client-side upload constraints (ADR-049 §6) — shared by ImageUploadField,
// MediaPickerDialog and the rich-text editor so the three cannot drift on
// what they claim to accept.
//
// These are a COURTESY, not a boundary. @repo/core re-derives the kind from
// magic bytes and re-checks the per-kind `media.maxBytes.{kind}` setting on
// every upload regardless of what happens here (security.md #9, ADR-034 §1).
// The point is that a 200 MB file should not have to finish uploading before
// the admin is told it is too large, and that the reason should carry the
// real numbers rather than a generic failure.

/** Mirrors DEFAULT_MAX_BYTES in packages/core/src/media.ts. The settings
 * rows (`media.maxBytes.*`) can raise these server-side; a client that is
 * behind therefore only ever refuses EARLY, never accepts something the
 * server would reject — the safe direction to be stale in. */
const CLIENT_MAX_BYTES = {
  IMAGE: 5 * 1024 * 1024,
  VIDEO: 100 * 1024 * 1024,
  AUDIO: 20 * 1024 * 1024,
  DOCUMENT: 20 * 1024 * 1024,
} as const;

export type ConstrainedKind = keyof typeof CLIENT_MAX_BYTES;

const ACCEPT: Record<ConstrainedKind, string> = {
  IMAGE:
    "image/png,image/jpeg,image/gif,image/webp,image/x-icon,image/vnd.microsoft.icon,image/svg+xml",
  VIDEO: "video/mp4,video/webm",
  AUDIO: "audio/mpeg,audio/mp4",
  DOCUMENT: "application/pdf",
};

export function fileAcceptAttribute(kinds: readonly ConstrainedKind[]): string {
  return kinds.map((kind) => ACCEPT[kind]).join(",");
}

/** Best-effort kind for a File, from the browser's declared type. Only ever
 * used to choose WHICH cap to compare against for the early message — the
 * server never consults `File.type`. */
function guessKind(file: File): ConstrainedKind {
  if (file.type.startsWith("video/")) return "VIDEO";
  if (file.type.startsWith("audio/")) return "AUDIO";
  if (file.type === "application/pdf") return "DOCUMENT";
  return "IMAGE";
}

function formatMegabytes(bytes: number): string {
  const mb = bytes / 1024 / 1024;
  return mb >= 10 ? String(Math.round(mb)) : mb.toFixed(1);
}

/**
 * Returns a ready-to-show reason if the file is over its kind's cap, or
 * `null` if it is worth sending. `t` is a next-intl `admin` translator —
 * the message is a catalog string, not a literal (code-style.md #2).
 */
export function describeOversizeFile(
  file: File,
  t: (key: string, values?: Record<string, string>) => string,
): string | null {
  const max = CLIENT_MAX_BYTES[guessKind(file)];
  if (file.size <= max) return null;
  return t("uploadTooLarge", {
    size: formatMegabytes(file.size),
    max: formatMegabytes(max),
  });
}

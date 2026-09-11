// Human file sizes for download links (changes-11 PR 4.3).
//
// Binary units (KiB steps) presented with the familiar KB/MB/GB labels — the
// convention every desktop OS and every browser download panel uses, so a
// number here matches what the reader sees after they click.
//
// Deliberately NOT localized: the unit suffixes are the same three ASCII
// letters in every locale we ship, and threading a formatter through would buy
// a decimal separator at the cost of a required `locale` argument on a pure
// helper. If a locale ever needs translated units, that is a catalog key at
// the call site, not a change here.

const UNITS = ["B", "KB", "MB", "GB", "TB"] as const;

/**
 * `formatBytes(0)` → "0 B", `formatBytes(1536)` → "1.5 KB".
 *
 * Whole bytes and whole kilobytes print without a decimal; anything larger
 * keeps one, because "1 MB" and "1.9 MB" are meaningfully different sizes to
 * someone on a metered connection.
 *
 * A negative or non-finite input returns "0 B" rather than throwing: this
 * renders inside a link on a public page, and a size that cannot be computed
 * should not take the page down with it.
 */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";

  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }

  // Round FIRST, then re-check: 1048000 bytes is 1023.4 KB, which rounds to
  // "1023.4 KB" — fine — but 1048570 is 1023.99 KB, which would print
  // "1024.0 KB" instead of stepping up to "1 MB".
  const rounded = unit === 0 ? Math.round(value) : Number(value.toFixed(1));
  if (rounded >= 1024 && unit < UNITS.length - 1) {
    return `1 ${UNITS[unit + 1]}`;
  }

  return unit <= 1 ? `${Math.round(rounded)} ${UNITS[unit]}` : `${rounded} ${UNITS[unit]}`;
}

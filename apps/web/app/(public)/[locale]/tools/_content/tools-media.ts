// The tools area's imagery (changes-33) — the ADR-047 §3 pattern.
//
// A `null` entry is not a defect: the masthead stands as a plain
// `--secondary` band (ADR-117), so the page ships complete with no
// photography committed, and a real asset lands later by editing this one
// line.
//
// **Only the INDEX has one.** The eight tool pages deliberately do not: each
// opens on a compact banner directly above a form the reader came to fill in,
// and a photograph between the two is decoration in front of the thing being
// used. ADR-086 §9 made those heroes dense for the same reason.

export type ToolsImage = string | null;

export const TOOLS_MEDIA = {
  /** `/tools` — the index, above the grid of eight. */
  banner: "/banners/tools.webp",
} satisfies Record<string, ToolsImage>;

export type ToolsMediaKey = keyof typeof TOOLS_MEDIA;

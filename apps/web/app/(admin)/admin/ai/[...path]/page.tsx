import { redirect } from "next/navigation";

/** The tabs a legacy path may name; anything else lands on the section. */
const TABS = new Set(["features", "limits", "providers"]);

// The AI area moved under Settings as tabs (changes-51). `/admin/ai/<tab>`
// bookmarks keep their path under `/admin/settings/ai`; `../page.tsx` handles
// `/admin/ai` itself.
//
// No gate here: the destination's layout and page gate themselves, and a
// redirect reveals nothing the new URL would not.
export default async function LegacyAiTabPage({ params }: PageProps<"/admin/ai/[...path]">) {
  const [tab, ...rest] = (await params).path;
  if (!tab || !TABS.has(tab)) redirect("/admin/settings/ai");
  // Each segment re-encoded: a provider id is the only free-form part, and the
  // prefix is fixed, so nothing here can point off the section.
  redirect(["/admin/settings/ai", tab, ...rest.map(encodeURIComponent)].join("/"));
}

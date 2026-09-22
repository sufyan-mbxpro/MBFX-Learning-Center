import { redirect } from "next/navigation";

/** The tabs a legacy path may name; anything else lands on the section. */
const TABS = new Set(["features", "limits", "providers"]);

// The AI area moved under Settings as tabs (changes-51). `/keystone/ai/<tab>`
// bookmarks keep their path under `/keystone/settings/ai`; `../page.tsx` handles
// `/keystone/ai` itself.
//
// No gate here: the destination's layout and page gate themselves, and a
// redirect reveals nothing the new URL would not.
export default async function LegacyAiTabPage({ params }: PageProps<"/keystone/ai/[...path]">) {
  const [tab, ...rest] = (await params).path;
  if (!tab || !TABS.has(tab)) redirect("/keystone/settings/ai");
  // Each segment re-encoded: a provider id is the only free-form part, and the
  // prefix is fixed, so nothing here can point off the section.
  redirect(["/keystone/settings/ai", tab, ...rest.map(encodeURIComponent)].join("/"));
}

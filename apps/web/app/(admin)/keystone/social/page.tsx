import { redirect } from "next/navigation";

// Social links moved under the settings hub (changes-01) — old bookmarks
// keep working.
export default function LegacySocialPage() {
  redirect("/keystone/settings/social");
}

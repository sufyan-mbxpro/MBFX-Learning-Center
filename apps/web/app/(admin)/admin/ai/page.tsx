import { redirect } from "next/navigation";

// The AI area moved under Settings as tabs (changes-51) — old bookmarks keep
// working, the way `/admin/social` does after changes-01. `/admin/ai` was the
// Usage screen, so it opens the Usage tab.
export default function LegacyAiPage() {
  redirect("/admin/settings/ai/usage");
}

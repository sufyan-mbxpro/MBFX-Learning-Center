import { redirect } from "next/navigation";

// The AI area moved under Settings as tabs (changes-51) — old bookmarks keep
// working, the way `/keystone/social` does after changes-01. `/keystone/ai` was the
// Usage screen, so it opens the Usage tab.
export default function LegacyAiPage() {
  redirect("/keystone/settings/ai/usage");
}

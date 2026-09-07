import { redirect } from "next/navigation";

// The Overview dashboard is Phase 3 (plan §8.2/§8.3) — until then the
// section's index redirects straight to its first real screen.
export default function WebsiteIndexPage() {
  redirect("/admin/website/pages");
}

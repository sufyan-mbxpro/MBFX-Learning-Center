import type { Metadata } from "next";
import "../globals.css";

// Root layout for the ADMIN surface — one of two root layouts in this app
// (Next.js "multiple root layouts" convention: no top-level app/layout.tsx,
// one layout per route group, each owning <html> and <body>).
// See docs/memory/decisions/ADR-006-single-app-route-groups.md.
//
// Admin is authenticated and entirely dynamic, so it opts out of static
// rendering here rather than per page. The STAFF gate lives in
// apps/web/proxy.ts AND is re-checked server-side once @repo/auth exists
// (Module 04) — the proxy is a gate, not the security boundary.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "MBFX Admin",
  description: "MBFX Learning Center — admin portal.",
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}

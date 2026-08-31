import type { Metadata } from "next";
import "../globals.css";

// Root layout for the PUBLIC surface. The (public) and (admin) route groups
// each own a root layout (Next.js multiple-root-layouts pattern) — see
// docs/memory/decisions/ADR-006-single-app-route-groups.md.
//
// The real version — theme injection, next-intl provider, dir/lang from the
// active locale — lands in Module 08/12. Deliberately no next/font/google:
// fonts are curated + self-hosted (ADR-005).
export const metadata: Metadata = {
  title: "MBFX Learning Center",
  description: "Forex learning platform — scaffold in progress.",
};

export default function PublicRootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}

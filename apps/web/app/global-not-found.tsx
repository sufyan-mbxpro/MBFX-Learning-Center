import type { Metadata } from "next";
import Link from "next/link";
import "@repo/ui/globals.css";

// Next 16's global-not-found convention (see next.config.ts's
// `experimental.globalNotFound`): the ONE catch-all for a URL that matches
// no route at all, and for a `notFound()` thrown from a layout before it
// ever returns its own shell — the exact situation the (public) surface's
// [locale] layout hits for an unrecognized locale segment, since that
// layout IS the one rendering <html> (ADR-006: no top-level app/layout.tsx
// to fall back on). Bypasses every other layout, so it's self-contained:
// its own <html>, its own stylesheet import, no next-intl/theme context
// available — deliberately plain, not localized.
export const metadata: Metadata = {
  title: "Not Found — MBFX Learning Center",
  description: "The page you are looking for does not exist.",
};

export default function GlobalNotFound() {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">
        <main className="flex min-h-full flex-col items-center justify-center gap-4 p-8">
          <h1 className="text-lg font-semibold">Page not found</h1>
          <Link href="/" className="text-sm underline underline-offset-4">
            Back to home
          </Link>
        </main>
      </body>
    </html>
  );
}

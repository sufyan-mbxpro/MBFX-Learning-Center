import type { Metadata } from "next";
import Link from "next/link";
import { SearchX } from "lucide-react";
import { Button } from "@repo/ui/components/button";
import { EmptyState } from "@repo/ui/components/empty";
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
  title: "Not Found — MBX Learning Center",
  description: "The page you are looking for does not exist.",
};

export default function GlobalNotFound() {
  return (
    // suppressHydrationWarning: this file owns its own <html>/<body> because
    // it bypasses every layout, so it needs the same browser-extension
    // tolerance the three root layouts already carry — extensions
    // (ColorZilla's cz-shortcut-listen is the one seen here) stamp
    // attributes on <body> before React hydrates.
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full" suppressHydrationWarning>
        {/* The shared EmptyState, so even the layout-less 404 is the design
            system's (changes-21 Phase A). Still literal English: this file has
            no intl context, as the header explains. There is no theme row
            either, so it renders on globals.css's default tokens. */}
        <main className="px-4">
          <EmptyState
            size="lg"
            titleAs="h1"
            icon={<SearchX aria-hidden />}
            title="Page not found"
            description="The page may have moved, or the address may be mistyped."
            action={<Button render={<Link href="/" />}>Back to home</Button>}
          />
        </main>
      </body>
    </html>
  );
}

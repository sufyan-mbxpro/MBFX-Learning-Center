"use client";

import "@repo/ui/globals.css";
import { Button } from "@repo/ui/components/button";
import { ErrorState } from "@repo/ui/components/empty";

// Next's global-error convention: the boundary for an error thrown by a ROOT
// layout, which no segment `error.tsx` can catch because it renders inside
// that layout. With three root layouts and no app/layout.tsx (ADR-006), this is
// the only file that covers all of them; without it Next showed its own
// unstyled page (changes-21 Phase A).
//
// Like global-not-found.tsx it replaces the whole document, so it owns
// <html>/<body>, imports the stylesheet itself, and has no intl or theme
// context — literal English is that file's documented exception, and applies
// here for the same reason.
//
// `retry`, never `reset` (changes-21 F-06): `reset` re-renders WITHOUT
// re-fetching, so a server-side failure fails again the same way. `retry`
// re-fetches then re-renders; stable since Next 16.3.
export default function GlobalError({ retry }: { error: Error; retry: () => void }) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full" suppressHydrationWarning>
        <main className="px-4">
          <ErrorState
            size="lg"
            titleAs="h1"
            title="Something went wrong"
            description="Something stopped this page from loading. Try again, or come back in a moment."
            action={
              <Button variant="outline" onClick={retry}>
                Try again
              </Button>
            }
          />
        </main>
      </body>
    </html>
  );
}

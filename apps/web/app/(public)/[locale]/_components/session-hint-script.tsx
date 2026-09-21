"use client";

// Injects the pre-paint session hint (ADR-124 §3; `_lib/session-hint.ts`
// explains why it exists). Built exactly like `@repo/ui`'s ThemeScript, for
// code-style #20's reason: a `<script>` in the React tree never executes, so
// it goes out through `useServerInsertedHTML`, whose callback runs only on the
// server, and the component renders `null`. No nonce — the public layout is
// cached and has no request to read one from (the public CSP allows inline
// script for the same reason ThemeScript relies on).
import { useServerInsertedHTML } from "next/navigation";
import { useRef } from "react";

import { buildSessionHintScript } from "../../../_lib/session-hint.ts";

export function SessionHintScript() {
  const emitted = useRef(false);

  useServerInsertedHTML(() => {
    if (emitted.current) return null;
    emitted.current = true;
    return <script dangerouslySetInnerHTML={{ __html: buildSessionHintScript() }} />;
  });

  return null;
}

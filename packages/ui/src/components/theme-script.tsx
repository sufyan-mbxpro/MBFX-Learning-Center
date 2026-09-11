"use client";

// The pre-paint mode guard (ADR-064).
//
// It is injected through `useServerInsertedHTML`, NOT rendered as JSX, and that
// is the whole point. React 19.2 warns — and substitutes a <div> — whenever a
// <script> is created on the client render path, because a script React creates
// on the client never executes. Rendering it from a server component was not
// enough: the element still lives in the RSC payload, and Next 16's client
// prerender/recovery passes create host instances from that payload.
//
// `useServerInsertedHTML`'s callback runs ONLY on the server — on the client
// `ServerInsertedHTMLContext` is null and the hook is a no-op — so the script
// exists solely as server-rendered HTML, which the parser executes. This
// component renders `null` in the browser. That is why the file is a client
// component despite emitting server-only output: the hook needs a client
// context to attach to.
//
// Next flushes inserted HTML into <head>, ahead of <body>, so the class lands
// before first paint. Mount it in every root layout, above the provider.
// `nonce` comes from the proxy's per-request header on the dynamic admin
// surfaces (security.md #14); the cached public layout has no request to read
// one from and passes none.
import { useServerInsertedHTML } from "next/navigation";
import { useRef } from "react";

import { buildThemeInitScript } from "@repo/ui/lib/theme-mode";

function ThemeScript({ nonce }: { nonce?: string }) {
  // Next invokes every registered callback on each flush; the guard keeps a
  // streamed response from emitting the same script twice.
  const emitted = useRef(false);

  useServerInsertedHTML(() => {
    if (emitted.current) return null;
    emitted.current = true;
    return <script nonce={nonce} dangerouslySetInnerHTML={{ __html: buildThemeInitScript() }} />;
  });

  return null;
}

export { ThemeScript };

"use client";

// A TradingView widget, framed (ADR-136 §2, §7).
//
// **No vendor script.** The server builds both URLs with
// `tradingViewWidgetUrl` (`@repo/utils`), and this island only chooses one.
// Nothing here renders a `<script>`, which code-style.md #20 would make a
// no-op anyway, and the public CSP's `script-src` stays closed to the vendor.
//
// **The frame follows the reader's mode.** TradingView takes a colour theme in
// the URL fragment, so the island picks the light or dark URL from
// `resolvedTheme`. The iframe is KEYED by the mode because changing only a
// fragment is a same-document navigation, and the frame would keep its old
// theme.
//
// **Nothing is framed before hydration.** The server cannot know the reader's
// mode, and framing the light widget first would load it twice for every dark
// reader. A placeholder of the same height holds the space, so the page does
// not shift when the frame arrives.
import { useSyncExternalStore } from "react";
import { useTheme } from "@repo/ui/components/theme-provider";
import { Skeleton } from "@repo/ui/components/skeleton";
import { cn } from "@repo/ui/lib/utils";

const noop = () => () => {};

export function TradingViewFrame({
  urls,
  title,
  className,
}: {
  urls: { light: string; dark: string };
  title: string;
  /** The frame's height, as a scale class, e.g. `h-112`. */
  className: string;
}) {
  const { resolvedTheme } = useTheme();
  // `true` on the client, `false` during SSR and hydration, with no effect.
  const hydrated = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );

  if (!hydrated) return <Skeleton aria-hidden className={cn("w-full rounded-none", className)} />;

  const src = urls[resolvedTheme];

  return (
    <iframe
      // Keyed by the WHOLE URL, not by the mode. Every setting the widget
      // takes — its theme and its symbol list alike — lives in the fragment,
      // and changing only a fragment is a same-document navigation: the frame
      // keeps the widget it already has. Keying on the URL remounts it, which
      // is the only way to change what a cross-origin frame is showing.
      key={src}
      src={src}
      title={title}
      loading="lazy"
      referrerPolicy="strict-origin-when-cross-origin"
      className={cn("block w-full border-0", className)}
    />
  );
}

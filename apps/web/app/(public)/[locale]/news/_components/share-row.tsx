"use client";

// Article share row (changes-05 reference screenshot). Platform buttons use
// the standard public share-intent URLs, not embedded brand logos: the
// installed lucide-react no longer ships Facebook/Twitter/Linkedin icons,
// and footer.tsx already established the house convention of a labelled
// fallback over a hand-drawn third-party logo (see its APP_PLATFORM_ICON
// comment). `window.location.href` is read only inside the click handlers,
// never at render time, so there is nothing for SSR/hydration to disagree on.
import { useState } from "react";
import { Check, Link2 } from "lucide-react";

const LINK_CLASS =
  "rounded-md border bg-card px-2.5 py-1 text-xs transition-[background-color,transform] duration-(--duration-fast) hover:-translate-y-0.5 hover:bg-primary/10 hover:text-primary-interactive";

export function ShareRow({
  title,
  shareLabel,
  facebookLabel,
  twitterLabel,
  linkedinLabel,
  copyLabel,
  copiedLabel,
}: {
  title: string;
  shareLabel: string;
  facebookLabel: string;
  twitterLabel: string;
  linkedinLabel: string;
  copyLabel: string;
  copiedLabel: string;
}) {
  const [copied, setCopied] = useState(false);

  function openIntent(build: (url: string) => string) {
    window.open(build(window.location.href), "_blank", "noopener,noreferrer,width=600,height=500");
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard permission can be denied — the URL is still shareable
      // from the address bar, so this fails silently rather than erroring.
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm font-medium text-muted-foreground">{shareLabel}</span>
      <button
        type="button"
        className={LINK_CLASS}
        onClick={() =>
          openIntent(
            (url) => `https://www.facebook.com/sharer/sharer.php?${new URLSearchParams({ u: url })}`,
          )
        }
      >
        {facebookLabel}
      </button>
      <button
        type="button"
        className={LINK_CLASS}
        onClick={() =>
          openIntent(
            (url) => `https://twitter.com/intent/tweet?${new URLSearchParams({ url, text: title })}`,
          )
        }
      >
        {twitterLabel}
      </button>
      <button
        type="button"
        className={LINK_CLASS}
        onClick={() =>
          openIntent(
            (url) => `https://www.linkedin.com/sharing/share-offsite/?${new URLSearchParams({ url })}`,
          )
        }
      >
        {linkedinLabel}
      </button>
      <button
        type="button"
        onClick={copyLink}
        className={`inline-flex items-center gap-1.5 ${LINK_CLASS}`}
      >
        {copied ? <Check aria-hidden className="size-3.5" /> : <Link2 aria-hidden className="size-3.5" />}
        {copied ? copiedLabel : copyLabel}
      </button>
    </div>
  );
}

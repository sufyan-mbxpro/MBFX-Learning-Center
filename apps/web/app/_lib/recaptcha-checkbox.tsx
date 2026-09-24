"use client";

// The "I'm not a robot" box (ADR-158), drawn inside a guarded form when
// Settings → General → reCAPTCHA is set to Checkbox. In Score mode (v3) there
// is nothing to draw and this renders nothing.
//
// Google draws the widget into an element it owns, so that element is created
// here rather than by React: React never reconciles children it did not make,
// and a remount (Strict Mode, a key change in the settings tab) gets a fresh
// element instead of one Google has already rendered into.
import { useEffect, useRef } from "react";
import type { CaptchaClientConfig } from "@repo/contracts";
import { loadRecaptchaScript, RECAPTCHA_EXPLICIT, registerRecaptchaCheckbox } from "./recaptcha.ts";

export function RecaptchaCheckbox({ captcha }: { captcha: CaptchaClientConfig | null }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const siteKey = captcha?.mode === "CHECKBOX" ? captcha.siteKey.trim() : "";

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !siteKey) return;
    const target = document.createElement("div");
    host.appendChild(target);
    let cancelled = false;
    loadRecaptchaScript(RECAPTCHA_EXPLICIT)
      .then((api) => {
        if (cancelled) return;
        // The reader's colour mode at the moment it is drawn; Google's widget
        // cannot change theme once rendered.
        const theme = document.documentElement.classList.contains("dark") ? "dark" : "light";
        const widgetId = api.render(target, { sitekey: siteKey, theme });
        registerRecaptchaCheckbox({ widgetId, siteKey });
      })
      // A blocked script leaves the box empty; the submit then says why.
      .catch(() => undefined);
    return () => {
      cancelled = true;
      registerRecaptchaCheckbox(null);
      target.remove();
    };
  }, [siteKey]);

  if (!siteKey) return null;
  // Google's widget is 304×78; reserving the height stops the form jumping.
  return <div ref={hostRef} className="min-h-19.5" />;
}

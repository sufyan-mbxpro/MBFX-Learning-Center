"use client";

// The homepage's opening band as a slider of published articles (ADR-140 §2).
//
// The SLIDES are server-rendered by `_sections/hero.tsx` and arrive here as
// nodes. This island owns only which one is showing, so every headline, every
// cover and every link is in the server HTML, and a visitor without JavaScript
// gets the first slide as an ordinary band.
//
// The slides share one grid cell (`col-start-1 row-start-1`) instead of being
// positioned. That makes the band as tall as its TALLEST slide, so a long
// headline on slide three cannot push the page when it arrives, and no slide
// needs a fixed height to stay inside the band.
//
// Motion: a slide advances on its own every `INTERVAL_MS`, and that stops
// while the pointer is over the band, while focus is inside it, and entirely
// under `prefers-reduced-motion`. There is no pause button (changes-43, the
// owner's call): hover and focus are the stop, and a keyboard reader who
// tabs to the arrows has already stopped it. A hidden slide is `inert`, so
// Tab never lands on a link the reader cannot see.
//
// The controls sit on the SAME line as the slide's buttons from `lg`. The
// slide is bottom-aligned with `lg:pb-28` (`_sections/hero.tsx`), so a row of
// the buttons' own height (`h-12`, Button size `xl`) at `lg:bottom-28` is that
// line. Below `lg` the buttons wrap, and the controls take a row under them.
import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@repo/ui/lib/utils";

const INTERVAL_MS = 7000;

export interface HeroSliderLabels {
  region: string;
  previous: string;
  next: string;
  /** One per slide, already formatted ("Article 2 of 5"). */
  positions: string[];
  /** One per slide, already formatted ("Show article 2 of 5"). */
  goTo: string[];
}

// On `--secondary`, opacities of `--secondary-foreground` are readable by
// construction (ADR-003), the idiom the hero's own ghost button uses.
// MUTED at rest (changes-45): no fill and a faint outline, so the arrows do
// not compete with the slide's own buttons on the same row. Hover and focus
// bring the fill, the outline and the full-strength glyph back.
const CONTROL =
  "inline-flex size-10 items-center justify-center rounded-md text-secondary-foreground/60 ring-1 ring-secondary-foreground/15 ring-inset transition-colors duration-(--duration-base) hover:bg-secondary-foreground/15 hover:text-secondary-foreground hover:ring-secondary-foreground/40 focus-visible:text-secondary-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

export function HeroSlider({
  slides,
  labels,
}: {
  slides: React.ReactNode[];
  labels: HeroSliderLabels;
}) {
  const count = slides.length;
  const [active, setActive] = useState(0);
  // Hover or focus inside the band.
  const [held, setHeld] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  const go = useCallback((index: number) => setActive(((index % count) + count) % count), [count]);

  const running = count > 1 && !held && !reducedMotion;
  useEffect(() => {
    if (!running) return;
    const timer = window.setTimeout(() => go(active + 1), INTERVAL_MS);
    return () => window.clearTimeout(timer);
  }, [running, active, go]);

  return (
    <section
      aria-roledescription="carousel"
      aria-label={labels.region}
      onPointerEnter={() => setHeld(true)}
      onPointerLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setHeld(false);
      }}
      className="relative isolate grid min-h-(--height-hero) grid-cols-1 overflow-hidden bg-secondary"
    >
      {slides.map((slide, index) => {
        const isActive = index === active;
        return (
          <div
            key={index}
            role="group"
            aria-roledescription="slide"
            aria-label={labels.positions[index]}
            aria-hidden={!isActive}
            inert={!isActive}
            className={cn(
              "col-start-1 row-start-1 flex transition-opacity duration-(--duration-slow) ease-(--ease-out-quint)",
              isActive ? "z-1 opacity-100" : "pointer-events-none opacity-0",
            )}
          >
            {slide}
          </div>
        );
      })}

      {count > 1 && (
        // Above the quick-start panel, which is pulled up across the band's
        // bottom edge; the band's own bottom padding leaves this row clear.
        <div className="pointer-events-none absolute inset-x-0 bottom-24 z-2 lg:bottom-28">
          <div className="container-page flex h-12 items-center justify-start gap-2 lg:justify-end">
            <div className="pointer-events-auto flex items-center gap-2">
              <button
                type="button"
                className={CONTROL}
                aria-label={labels.previous}
                onClick={() => go(active - 1)}
              >
                <ChevronLeft aria-hidden className="size-5 rtl:rotate-180" />
              </button>
              <ol className="flex items-center gap-1.5 px-1">
                {slides.map((_, index) => (
                  <li key={index}>
                    <button
                      type="button"
                      aria-label={labels.goTo[index]}
                      aria-current={index === active ? "true" : undefined}
                      onClick={() => go(index)}
                      // A 24px target around a small mark (WCAG 2.5.8).
                      className="group/dot flex size-6 items-center justify-center rounded-full focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    >
                      <span
                        className={cn(
                          "block h-1.5 rounded-full transition-all duration-(--duration-base)",
                          index === active
                            ? "w-5 bg-secondary-foreground"
                            : "w-1.5 bg-secondary-foreground/40 group-hover/dot:bg-secondary-foreground/70",
                        )}
                      />
                    </button>
                  </li>
                ))}
              </ol>
              <button
                type="button"
                className={CONTROL}
                aria-label={labels.next}
                onClick={() => go(active + 1)}
              >
                <ChevronRight aria-hidden className="size-5 rtl:rotate-180" />
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

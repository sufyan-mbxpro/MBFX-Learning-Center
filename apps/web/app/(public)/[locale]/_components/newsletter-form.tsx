// Footer newsletter (changes-03-plan.md §6.4).
//
// DELIBERATELY NOT ACCEPTING SUBMISSIONS YET. The plan calls for a real
// progressive-enhancement server action with a honeypot and a per-IP rate
// limit (security.md #13) — all of which is buildable, but a working signup
// needs somewhere to PUT the address, and there is no subscriber model in
// the schema. Adding one is a backend change the brief rules out unless
// genuinely required, and the Phase A decision (DEVLOG 2026-09-03) kept
// this work out of the database entirely.
//
// The alternative — wiring a form that validates, rate-limits and then
// drops the address on the floor — would look like it works to every
// visitor who uses it. That is the one outcome worth avoiding, so the
// control ships visibly pending instead: correct design, honest state.
//
// TODO(newsletter): when a NewsletterSubscriber model + its ADR land, this
// becomes a client component posting to a server action; the markup below
// is already the target shape.
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { cn } from "@repo/ui/lib/utils";

export function NewsletterForm({
  placeholder,
  label,
  submitLabel,
  unavailableLabel,
  tone = "default",
  id = "newsletter-unavailable",
}: {
  placeholder: string;
  label: string;
  submitLabel: string;
  unavailableLabel: string;
  /**
   * "onFill" is for the CTA band, where the surface is `bg-primary` —
   * `text-muted-foreground` is tuned for the page background and would be
   * close to illegible on a filled band. "onSecondary" is the footer's own
   * `bg-secondary` band: a DIFFERENT fill, so it needs the button to stay
   * `default` (primary pops against secondary — the "onFill" swap to a
   * `secondary` button would blend into a `bg-secondary` surface) and its
   * own foreground token for the unavailable-label text.
   */
  tone?: "default" | "onFill" | "onSecondary";
  /** Unique per instance: the homepage band and the footer both render one. */
  id?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Input
          type="email"
          name="email"
          aria-label={label}
          placeholder={placeholder}
          disabled
          aria-describedby={id}
          className={cn("flex-1", tone !== "default" && "bg-background")}
        />
        <Button type="button" variant={tone === "onFill" ? "secondary" : "default"} disabled>
          {submitLabel}
        </Button>
      </div>
      <p
        id={id}
        className={cn(
          "text-xs",
          tone === "onFill" && "text-primary-foreground/80",
          tone === "onSecondary" && "text-secondary-foreground/70",
          tone === "default" && "text-muted-foreground",
        )}
      >
        {unavailableLabel}
      </p>
    </div>
  );
}

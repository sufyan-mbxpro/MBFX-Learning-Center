import type { ComponentType } from "react";
import {
  Activity,
  Archive,
  LogIn,
  Pencil,
  Plus,
  Send,
  ShieldCheck,
  Trash2,
  Upload,
} from "lucide-react";

// changes-43: each entry leads with a glyph for WHAT KIND of thing happened,
// read from the action key's verb ("article.publish", "user.role.assign").
// The glyph carries the meaning and the tint only repeats it, so the feed is
// never colour-alone. Anything unrecognised falls through to the neutral
// Activity mark rather than guessing — the words beside it are the record.
type Kind = { icon: ComponentType<{ className?: string }>; tone: string };

const NEUTRAL: Kind = { icon: Activity, tone: "bg-muted text-muted-foreground" };

/** Whole segments only, with an optional past tense: `ban` must not claim `banner.update`. */
function verbs(stems: string): RegExp {
  return new RegExp(`^(${stems})(e?d|s)?$`);
}

const KINDS: { match: RegExp; kind: Kind }[] = [
  {
    match: verbs("delete|remove|purge|erase|revoke|ban"),
    kind: { icon: Trash2, tone: "bg-destructive/10 text-destructive-interactive" },
  },
  {
    match: verbs("archive|deactivate|suspend|unpublish|unsubscribe"),
    kind: { icon: Archive, tone: "bg-warning/15 text-warning-interactive" },
  },
  {
    match: verbs("publish|schedule|approve|send|sent"),
    kind: { icon: Send, tone: "bg-success/10 text-success-interactive" },
  },
  {
    match: verbs("create|add|invite|register|restore"),
    kind: { icon: Plus, tone: "bg-success/10 text-success-interactive" },
  },
  {
    match: verbs("upload|import"),
    kind: { icon: Upload, tone: "bg-info/10 text-info-interactive" },
  },
  {
    match: verbs("role|roles|permission|permissions|password|twofactor|impersonate|impersonation"),
    kind: { icon: ShieldCheck, tone: "bg-primary-subtle text-primary-interactive" },
  },
  {
    match: verbs("signin|login|session"),
    kind: { icon: LogIn, tone: "bg-primary-subtle text-primary-interactive" },
  },
  {
    match: verbs("update|edit|save|change|set|reorder|move|rename|toggle|assign"),
    kind: { icon: Pencil, tone: "bg-info/10 text-info-interactive" },
  },
];

export function activityKind(action: string): Kind {
  const segments = action.toLowerCase().split(/[._:/\s-]+/);
  return (
    KINDS.find((entry) => segments.some((segment) => entry.match.test(segment)))?.kind ?? NEUTRAL
  );
}

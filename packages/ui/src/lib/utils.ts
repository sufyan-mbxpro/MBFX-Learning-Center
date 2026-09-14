import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// tailwind-merge only knows Tailwind's DEFAULT theme. A named step this
// design system adds is an unknown word to it, and it guesses: `text-nav`
// reads as a text COLOUR, so `cn("text-nav", "text-accent-foreground")`
// dropped the size — the active admin nav row rendered at 16px instead of
// 13px (changes-20 Phase 6, found signed in as the admin). The public
// display steps had the same exposure (`text-display-lg` + any ink).
//
// Every custom step in globals.css `@theme` is registered here, by the
// theme scale it extends, so a merge treats it as what it is. A new
// `--text-*`, `--shadow-*`, `--tracking-*`, `--radius-*` or `--ease-*` token
// is added to this list in the same change (utils.test.ts checks the file).
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ["3xs", "2xs", "nav", "display-sm", "display-md", "display-lg", "display-numeral"],
      shadow: ["card", "card-hover", "float", "dock"],
      tracking: ["caps"],
      radius: ["pill"],
      ease: ["out-quint", "spring"],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

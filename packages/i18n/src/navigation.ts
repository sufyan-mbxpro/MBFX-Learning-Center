// Locale-aware Link/redirect/usePathname/useRouter, bound to routing.ts.
// Components import these instead of next/navigation directly so a link to
// "/glossary" gets the current locale prefix automatically (or none, for
// the default locale under "as-needed").
import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing.ts";

export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);

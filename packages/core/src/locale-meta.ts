// Every seeded `Locale` row's display facts, active or not (ADR-127): the
// reading-language menu names languages the site does not serve.
import { db } from "@repo/db";
import type { LocaleMeta } from "./reading-languages.ts";

export async function loadLocaleMeta(): Promise<LocaleMeta[]> {
  return db.locale.findMany({
    select: { code: true, nativeName: true, direction: true, sortOrder: true },
  });
}

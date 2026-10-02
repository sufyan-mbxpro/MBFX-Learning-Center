import { getSetting } from "@repo/settings";
import { getSiteTimeZone, setSiteTimeZone } from "@repo/utils";

/**
 * Read Settings → General → Default timezone and make it the zone every date
 * on this server is printed in (ADR-182). Called by each root layout, so a
 * change reaches the next render after its save invalidates `settings:general`.
 * Returns the zone for the layout to hand to the browser (`<SiteTimeZone>`) and
 * to next-intl's client provider; "UTC" when the stored value is unusable.
 */
export async function loadSiteTimeZone(): Promise<string> {
  setSiteTimeZone(await getSetting("site.defaultTimezone"));
  return getSiteTimeZone() ?? "UTC";
}

// Parses the panel's `datetime-local` value into an instant (ADR-071 #4).
// Not a "use server" file — a "use server" module may export only async
// functions, and this is the shared sync parse the five status actions run
// before handing off to @repo/core.
import { z } from "zod";

/**
 * The wire value is an ISO string the browser produced from the editor's LOCAL
 * time, so the timezone is already resolved by the time it arrives — there is
 * no picker and no stored zone, which is the article panel's existing
 * behaviour and ADR-071's "deliberately not built".
 *
 * `undefined` in means `undefined` out: a transition that is not SCHEDULED
 * carries no date, and `transitionContentStatus` distinguishes "no date given"
 * from "a date in the past" — the second is a `ScheduleInPastError`, the first
 * is simply a non-scheduling move.
 */
export function parseScheduledFor(iso: string | undefined): Date | undefined {
  return iso ? z.coerce.date().parse(iso) : undefined;
}

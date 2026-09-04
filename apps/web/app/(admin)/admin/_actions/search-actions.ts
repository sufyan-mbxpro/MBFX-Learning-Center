"use server";

// Global admin search (changes-01). No single permission key — the palette
// is available to all STAFF, and searchAdmin gates every data section by
// can() on the server (users.view, roles.view, …); a subject with none of
// them gets empty sections, not an error.
import { adminSearchSchema } from "@repo/contracts";
import { searchAdmin, type AdminSearchResults } from "@repo/core";
import { requireStaffSubject } from "./staff-subject.ts";

export async function searchAdminAction(query: string): Promise<AdminSearchResults> {
  const subject = await requireStaffSubject();
  const { query: parsed } = adminSearchSchema.parse({ query });
  return searchAdmin(subject, parsed);
}

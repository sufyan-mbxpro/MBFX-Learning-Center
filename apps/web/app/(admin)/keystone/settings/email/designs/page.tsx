import { redirect } from "next/navigation";

// `/keystone/settings/email/designs` is the breadcrumb between a design's
// editor and the list. The list is a section of the Templates tab (ADR-172
// #3), so the segment answers by going there rather than by a second list.
export default function EmailDesignsIndex(): never {
  redirect("/keystone/settings/email/templates");
}

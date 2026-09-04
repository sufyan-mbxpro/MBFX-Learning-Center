import { notFound } from "next/navigation";
import { KitchenSink } from "./kitchen-sink-client";

// Dev-only design-system review page (Module 07 DoD). The folder is named
// %5Fdev — the URL-encoded underscore — because a literal _dev folder is
// Next's private-folder convention and never routes; this way the URL is
// /admin/_dev/kitchen-sink as the plan specifies. Staff gate: the (admin)
// root layout's DB-backed re-check runs before this renders, same as every
// admin route. On top of that, production builds 404 it outright.
export default function KitchenSinkPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <KitchenSink />;
}

import { subscriberExportSchema } from "@repo/contracts";
import { exportSubscribersCsv } from "@repo/core";
import { requirePermission } from "@repo/rbac";

// The subscriber CSV export (ADR-080 #7).
//
// **A route, not a server action**, for one reason: it STREAMS. An action has
// to return a value, so the whole file would be built in memory and then
// serialised through the RSC payload — and an export is unbounded by design,
// since that is what "export the list" means. A `ReadableStream` hands the
// rows to the browser as the database produces them.
//
// **`newsletter.export` is its own permission**, separate from `.view` and
// `.manage`: reading a page of addresses on screen and walking out with every
// address in a file are different acts, and only one of them leaves the
// system with a copy. `exportSubscribersCsv` audits before it yields a byte —
// the audit row is written even if the download is cancelled halfway, which is
// the right way round.
//
// `requirePermission` runs first and IS the boundary; the proxy's STAFF gate
// is a gate, not a guarantee (security.md #3). Filters are parsed, never cast
// (security.md #6).
//
// The CSV's cells are formula-neutralised in core, not here: `=HYPERLINK(...)`
// in an address field is a phishing link in a file an administrator
// downloaded from their own admin, and the guard belongs beside the code that
// builds the row.
export async function GET(request: Request): Promise<Response> {
  const subject = await requirePermission("newsletter.export");

  const params = new URL(request.url).searchParams;
  const parsed = subscriberExportSchema.safeParse({
    status: params.get("status") ?? undefined,
    source: params.get("source") ?? undefined,
    q: params.get("q") ?? undefined,
  });
  // A bad filter exports NOTHING rather than everything. The opposite default
  // would turn a typo in a query string into a full-list download.
  if (!parsed.success) {
    return new Response("Invalid filters", {
      status: 400,
      headers: { "cache-control": "no-store" },
    });
  }

  // The iterator is taken ONCE and held. Calling `[Symbol.asyncIterator]()`
  // inside `pull` happens to work for an async generator (it returns `this`),
  // but it reads as though each pull restarts the query — and it would, for
  // any other async iterable.
  const rows = exportSubscribersCsv(subject, parsed.data)[Symbol.asyncIterator]();
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      const next = await rows.next();
      if (next.done) {
        controller.close();
        return;
      }
      controller.enqueue(encoder.encode(next.value));
    },
    // A reader who closes the tab mid-download stops the query too, rather
    // than leaving it paging to nowhere.
    cancel: async () => void (await rows.return?.(undefined)),
  });

  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(stream, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      // `attachment`, so a CSV is never rendered in the admin origin.
      "content-disposition": `attachment; filename="subscribers-${stamp}.csv"`,
      "cache-control": "no-store",
    },
  });
}

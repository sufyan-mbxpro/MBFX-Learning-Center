// Where the browser reports a Content-Security-Policy violation (changes-49).
//
// The policy is ENFORCED now, so a violation is something that did not load
// or did not run. Logging it is the whole job: it is how an enforced policy
// that breaks a widget says which directive did it, instead of the page
// silently missing a piece. Nothing is stored and nothing is echoed back.
//
// Anonymous by design — the browser sends it without credentials — so the
// body is capped and only a few named fields are read (security.md #6: parse,
// don't spread). No `requirePermission()`: this is not a mutation of anything
// we own, it is a log line.
const MAX_BYTES = 8 * 1024;

export async function POST(request: Request): Promise<Response> {
  const text = (await request.text()).slice(0, MAX_BYTES);
  try {
    const parsed = JSON.parse(text) as { "csp-report"?: Record<string, unknown> };
    const report = parsed["csp-report"];
    if (report && typeof report === "object") {
      console.warn("[csp]", {
        document: String(report["document-uri"] ?? "").slice(0, 300),
        directive: String(report["effective-directive"] ?? report["violated-directive"] ?? ""),
        blocked: String(report["blocked-uri"] ?? "").slice(0, 300),
      });
    }
  } catch {
    // A malformed report is not worth a 400 to a browser that cannot act on it.
  }
  return new Response(null, { status: 204 });
}

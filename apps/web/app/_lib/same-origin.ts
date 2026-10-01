// Did this POST come from one of our own pages? (ADR-170 #3.3)
//
// Not authentication — a script sets any header it likes. What it stops is
// another SITE making its visitors' browsers post here, which a browser only
// does with truthful `Sec-Fetch-Site` and `Origin` headers it will not let a
// page forge. `Sec-Fetch-Site` is the modern answer; `Origin` covers a browser
// that predates it. A request carrying neither is refused: every browser that
// runs our `fetch` sends at least `Origin` on a POST.
export function isSameOriginRequest(headers: Headers, allowedOrigins: readonly string[]): boolean {
  const site = headers.get("sec-fetch-site");
  if (site !== null) return site === "same-origin";
  const origin = headers.get("origin");
  if (origin === null) return false;
  return allowedOrigins.includes(origin.replace(/\/+$/, ""));
}

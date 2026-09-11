// The caller's IP, for per-IP rate limiting (security.md #13).
//
// `x-forwarded-for` is a CLIENT-CONTROLLABLE header: anything upstream can
// append to it, and a caller can send one outright. Two consequences shape
// this helper:
//
//   1. **The LEFTMOST entry is the one nobody can forge past** only when every
//      proxy in front of this app is trusted and appends. Ours is a single
//      reverse proxy, so the leftmost entry is the client — but the value is
//      still attacker-influenced, which is why this is used ONLY as a rate
//      limit bucket and never as an identity, an authorization input, or an
//      audit claim we would defend.
//   2. **A missing header must not collapse every caller into one bucket.**
//      Returning a constant would let one client exhaust the shared budget for
//      everyone. `null` says "unknown", and the caller decides — the routes
//      here fall back to the session id, which every authenticated endpoint
//      already has.
const MAX_IP_LENGTH = 45; // an IPv6 address with an IPv4 tail

export function clientIp(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for");
  const candidate = forwarded?.split(",")[0]?.trim() ?? headers.get("x-real-ip")?.trim() ?? null;
  if (!candidate) return null;
  // Truncated rather than validated: this is a cache key, and a malformed
  // value is a bucket like any other. Bounding the length is what stops a
  // 10 KB header becoming a 10 KB Redis key.
  return candidate.slice(0, MAX_IP_LENGTH);
}

// `VideoObject` structured data (changes-16 PR 8).
//
// Same discipline as `CourseJsonLd` and the About section's `Organization`
// graph (ADR-047 §2): only fields we can state truthfully from data we already
// hold. A fabricated graph is worse than none, because JSON-LD is machine-read
// and syndicated out of the context that would expose it.
//
// ─── What is deliberately absent, and why ──────────────────────────────────
//
// `duration` — we do not store one. `MediaAsset.durationMs` exists but is
//   populated for nothing on this path, and Google treats a wrong `duration`
//   as a reason to drop the result, not to round it.
// `interactionStatistic` — there is no view counter (ADR-068 scoped it out),
//   so a `WatchAction` count would be a number we invented.
// `expires`, `regionsAllowed`, `isFamilyFriendly` — claims nobody has made.
//
// `uploadDate` is REQUIRED by the type and is the one field worth care: it is
// the topic's publication date, not the recording's, and those genuinely
// differ. That is the honest reading available to us — the page is what was
// published — and it is stated here so it is not "corrected" to a recording
// date the schema has no column for.
//
// ─── One graph, or none ────────────────────────────────────────────────────
//
// A topic with no attached recording emits NOTHING. It is a written guide, and
// a `VideoObject` describing a page with no video is exactly the kind of claim
// this file exists to avoid. The caller passes `videos` and gets null back.
export function VideoJsonLd({
  name,
  description,
  url,
  uploadDate,
  thumbnailUrl,
  embedUrl,
  contentUrl,
}: {
  name: string;
  description: string | null;
  /** Path, not an absolute URL — Next resolves it against `metadataBase`. */
  url: string;
  /** ISO 8601. The TOPIC's publication date — see the header note. */
  uploadDate: string;
  thumbnailUrl?: string | null;
  /** Set for a provider-hosted recording. */
  embedUrl?: string | null;
  /** Set for a self-hosted one. */
  contentUrl?: string | null;
}) {
  // Neither URL means there is nothing to describe — see the header note.
  if (!embedUrl && !contentUrl) return null;

  const graph = {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name,
    ...(description ? { description } : {}),
    url,
    uploadDate,
    ...(thumbnailUrl ? { thumbnailUrl } : {}),
    ...(embedUrl ? { embedUrl } : {}),
    ...(contentUrl ? { contentUrl } : {}),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }}
    />
  );
}

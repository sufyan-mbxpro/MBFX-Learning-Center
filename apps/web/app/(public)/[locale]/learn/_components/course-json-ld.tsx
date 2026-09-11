// `Course` structured data (plan §11, and `plan.md` Module 12 asks for it).
//
// Only fields we can state truthfully from data we hold, which is the same
// discipline the About section's `Organization` graph follows (ADR-047 §2):
// no rating, no price, no instructor, no `courseWorkload` we would have to
// invent. A fabricated graph is worse than none, because JSON-LD is
// machine-read and syndicated out of the context that would expose it.
//
// `hasPart` carries the SECTIONS, matching the plan. Lesson pages get no graph
// of their own in Phase 1 — a `LearningResource` per lesson would multiply the
// markup without adding a claim search engines act on for this content type.
//
// `provider` is deliberately absent: `Organization` is emitted once, by the
// About layout, and repeating a partial copy here would put two differently-
// shaped descriptions of the same entity in the index.
export function CourseJsonLd({
  name,
  description,
  url,
  sections,
}: {
  name: string;
  description: string | null;
  /** Path, not an absolute URL — Next resolves it against `metadataBase`. */
  url: string;
  sections: { name: string; lessonCount: number }[];
}) {
  const graph = {
    "@context": "https://schema.org",
    "@type": "Course",
    name,
    ...(description ? { description } : {}),
    url,
    // A course with no published sections emits no `hasPart` rather than an
    // empty array — "this course has zero parts" is a claim, and a wrong one
    // while the curriculum is still being written.
    ...(sections.length > 0
      ? {
          hasPart: sections.map((section) => ({
            "@type": "Syllabus",
            name: section.name,
          })),
        }
      : {}),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }}
    />
  );
}

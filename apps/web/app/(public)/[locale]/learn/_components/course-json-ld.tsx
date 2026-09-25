import { jsonLd } from "../../../../_lib/seo.ts";
import { siteUrl } from "../../../../_lib/site-url.ts";

// `Course` structured data (plan §11, and `plan.md` Module 12 asks for it).
//
// Only fields we can state truthfully from data we hold, which is the same
// discipline the About section's `Organization` graph follows (ADR-047 §2):
// no rating, no price, no instructor, no `courseWorkload` we would have to
// invent. A fabricated graph is worse than none, because JSON-LD is
// machine-read and syndicated out of the context that would expose it.
//
// `syllabusSections` carries the SECTIONS, the property schema.org defines for
// a course's `Syllabus` parts (it was `hasPart`, which Google does not read
// for a course). Lesson pages get no graph of their own in Phase 1 — a
// `LearningResource` per lesson would multiply the markup without adding a
// claim search engines act on for this content type.
//
// `provider` is REQUIRED for Google's course rich result. It references the
// home page's `Organization` by `@id` and repeats only its name and address,
// so the index sees one entity rather than two differently-shaped ones (the
// About layout that used to own the Organization is gone, ADR-109).
//
// Every URL is ABSOLUTE: `metadataBase` resolves the `Metadata` object only,
// never a JSON-LD body, so a path here reached Google as a path.
export function CourseJsonLd({
  name,
  description,
  path,
  providerName,
  sections,
}: {
  name: string;
  description: string | null;
  /** The course's own path; made absolute here. */
  path: string;
  /** `site.name` — the Organization the home page declares. */
  providerName: string;
  sections: { name: string; lessonCount: number }[];
}) {
  const origin = siteUrl();
  const graph = {
    "@context": "https://schema.org",
    "@type": "Course",
    name,
    ...(description ? { description } : {}),
    url: `${origin}${path}`,
    provider: {
      "@type": "Organization",
      "@id": `${origin}/#organization`,
      name: providerName,
      url: `${origin}/`,
    },
    // A course with no published sections emits no sections rather than an
    // empty array — "this course has zero parts" is a claim, and a wrong one
    // while the curriculum is still being written.
    ...(sections.length > 0
      ? {
          syllabusSections: sections.map((section) => ({
            "@type": "Syllabus",
            name: section.name,
          })),
        }
      : {}),
  };

  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(graph) }} />;
}

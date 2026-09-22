import { notFound } from "next/navigation";

// Where the proxy rewrites an address nothing answers (changes-49, ADR-146).
// It renders nothing of its own: `notFound()` outside any Suspense boundary is
// what makes the status a real 404, and `../not-found.tsx` draws the page.
export default function NotFoundPage(): never {
  notFound();
}

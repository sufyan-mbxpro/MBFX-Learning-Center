// The shared rich-text body style (changes-11 PR 4.3).
//
// This class string used to live inline in the article page, and the lesson
// page plus the course description now need the same thing. Copying an
// eighty-utility string into three files guarantees they diverge, so it lives
// here once and the callers pass HTML.
//
// The rules it carries are not decoration:
//
//   - `min-w-0 break-words` and the table scroll container (changes-10): an
//     author can insert tables and long code, and a wide one must scroll
//     INSIDE the column rather than widen the page.
//   - Heading, list, quote and code styling, because the stored HTML has no
//     classes of its own — `sanitizeRichText` allows only the `ed-*`
//     editorial vocabulary, which is defined outside any layer specifically so
//     an author's explicit choice beats these container rules.
//
// The HTML is sanitized SERVER-SIDE ON SAVE (security.md #8). This component
// renders already-clean markup; it is not, and must not become, the
// sanitization point.
import { cn } from "@repo/ui/lib/utils";

export function RichText({
  html,
  className,
}: {
  /** Stored HTML, already sanitized on save. */
  html: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-4 leading-relaxed break-words [&_a]:text-primary-interactive [&_a]:underline-offset-4 [&_a:hover]:underline [&_blockquote]:my-2 [&_blockquote]:border-y [&_blockquote]:border-border [&_blockquote]:py-6 [&_blockquote]:text-center [&_blockquote]:text-lg [&_blockquote]:font-medium [&_blockquote]:text-foreground [&_blockquote]:italic [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:font-mono [&_code]:text-sm [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:text-lg [&_h3]:font-semibold [&_h4]:font-semibold [&_img]:rounded-lg [&_ol]:list-decimal [&_ol]:ps-5 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-4 [&_table]:block [&_table]:w-full [&_table]:overflow-x-auto [&_table]:text-sm [&_td]:border [&_td]:p-2 [&_th]:border [&_th]:bg-muted/40 [&_th]:p-2 [&_th]:text-start [&_ul]:list-disc [&_ul]:ps-5",
        className,
      )}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

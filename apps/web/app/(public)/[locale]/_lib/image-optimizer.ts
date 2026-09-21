/**
 * Whether `next/image` may run a src through its optimizer (ADR-130).
 *
 * Only our own uploads qualify. An article cover can still hold an absolute
 * URL typed before the upload widget existed (`imageUrlSchema` accepts one),
 * and the optimizer throws for any host `images.remotePatterns` does not
 * list — allowlisting the world is the thing this avoids. An SVG is refused
 * by the optimizer (`dangerouslyAllowSVG` stays off), so it is served as is.
 */
export function canOptimizeImage(src: string): boolean {
  return src.startsWith("/uploads/") && !src.toLowerCase().endsWith(".svg");
}

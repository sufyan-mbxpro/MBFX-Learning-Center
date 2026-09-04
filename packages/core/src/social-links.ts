// Footer/header social links (Module 08). Cached under the `navigation`
// tag — social links render inside the same header/footer chrome the menu
// does, and the admin edits them on the same surfaces, so they share the
// invalidation lifecycle rather than minting another tag.
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@repo/db";

export interface SocialLinkItem {
  platform: string;
  label: string;
  url: string;
  icon: string;
  handle: string | null;
  openInNewTab: boolean;
  showInHeader: boolean;
  showInFooter: boolean;
}

/** Pure DB read, exported for tests (ADR-004). */
export async function loadActiveSocialLinks(): Promise<SocialLinkItem[]> {
  const rows = await db.socialLink.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    select: {
      platform: true,
      label: true,
      url: true,
      icon: true,
      handle: true,
      openInNewTab: true,
      showInHeader: true,
      showInFooter: true,
    },
  });
  return rows;
}

export async function getActiveSocialLinks(): Promise<SocialLinkItem[]> {
  "use cache";
  cacheTag("navigation");
  cacheLife({ revalidate: 300 });
  return loadActiveSocialLinks();
}

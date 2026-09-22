import { getTranslations } from "next-intl/server";
import { PageLoader } from "@repo/ui/components/page-loader";

// The generic admin pending state (changes-01, image-7: centered spinner +
// label inside the shell chrome).
//
// It used to be `keystone/loading.tsx`, one boundary over the whole portal.
// That boundary also sat above `[...notFound]`, and a Suspense fallback is
// what commits the response as 200 — so every unknown /keystone address
// answered 200 with 404 markup. Every real screen already declares its own
// pending state (`admin-loading.test.ts` proves it, and fails when a new one
// does not), so the boundary moved down to the sections that had none. The
// catch-all is left outside any of them deliberately: nothing streams, and
// the status is a real 404.
export default async function AdminLoading() {
  const t = await getTranslations("admin");
  return <PageLoader label={t("loading")} />;
}

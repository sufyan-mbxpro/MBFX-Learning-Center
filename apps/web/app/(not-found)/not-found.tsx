import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getBrandAssets } from "@repo/core";
import { BrandLogo } from "@repo/ui/components/brand-logo";
import { NotFoundView, notFoundLabels } from "../_components/not-found-view.tsx";

// The designed 404 for an address nothing answers (changes-49). English: the
// rewrite carries no locale segment, and only `en` is served (ADR-091).
export default async function StandaloneNotFound() {
  const [t, brandAssets] = await Promise.all([
    getTranslations({ locale: "en", namespace: "notFound" }),
    getBrandAssets(),
  ]);
  return (
    <NotFoundView
      labels={notFoundLabels(t)}
      // A full load into the site regardless: its root layouts differ.
      renderLink={(href) => <Link href={href} />}
      brand={
        <Link href="/" className="inline-flex">
          <BrandLogo
            light={brandAssets.logo_light?.url ?? null}
            dark={brandAssets.logo_dark?.url ?? null}
            alt=""
            className="h-12"
            fallback={<span className="text-xl font-semibold tracking-tight">MBX</span>}
          />
        </Link>
      }
    />
  );
}

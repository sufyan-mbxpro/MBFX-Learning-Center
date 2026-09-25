import { getTranslations } from "next-intl/server";
import { getBrandAssets } from "@repo/core";
import { getSetting } from "@repo/settings";
import { AuthSplit } from "@repo/ui/components/auth-split";
import { Reveal } from "@repo/ui/components/reveal";
import { authBrand } from "../../../_lib/auth-brand.tsx";

// The shell every public credential screen shares — sign-in, sign-up and the
// two recovery screens (changes-21 F6 extracted it; sign-in and sign-up now
// render through it too, rather than carrying their own copies).
//
// A split frame: the brand panel (the uploaded logo and the site's name,
// large) beside the form. The panel is
// hidden below `lg`, so on a phone the form is the whole screen.
export async function AuthScreen({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  /** The links under the form ("Back to sign in", "Create an account"). */
  footer?: React.ReactNode;
}) {
  const [t, common, siteName, brandAssets] = await Promise.all([
    getTranslations("auth"),
    getTranslations("common"),
    getSetting("site.name"),
    getBrandAssets(),
  ]);
  // The wordmark is `site.name`, the one brand name every other surface
  // prints; the catalog's is only the fallback for an unseeded row.
  const name = siteName?.trim() || common("siteName");
  const { panel, mark } = authBrand({
    logoAlt: name,
    brandAssets,
    wordmark: name,
    tagline: t("panelTagline"),
  });

  return (
    // `isolate` alongside `relative` keeps the glow in this element's own
    // stacking context.
    <main className="bg-glow-primary container-page relative isolate flex flex-1 items-center justify-center overflow-hidden py-8 lg:py-12">
      <Reveal variant="scale" className="flex w-full justify-center">
        <AuthSplit
          panel={panel}
          mark={mark}
          title={title}
          description={description}
          footer={footer}
        >
          {children}
        </AuthSplit>
      </Reveal>
    </main>
  );
}

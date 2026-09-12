import { getBrandAssets } from "@repo/core";
import { getSetting } from "@repo/settings";
import { AmbientMotif } from "@repo/ui/components/ambient-motif";
import { BrandLogo } from "@repo/ui/components/brand-logo";
import { Reveal } from "@repo/ui/components/reveal";

// The shell the public credential screens share (changes-21 F6).
//
// Sign-in and sign-up each carry their own copy of this markup, written before
// there was a second screen to share it with. The two recovery screens make it
// four, so this extracts it rather than adding two more copies. Converting the
// existing pair is a separate, mechanical change and deliberately not folded
// into a PR about password recovery.
//
// The logo is the admin-uploaded brand mark, as on the header, footer and admin
// shell: a credential screen showing the site's NAME while every other surface
// shows its mark is the one place a brand is most noticeably absent.
export async function AuthScreen({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  /** The "back to sign in" line under the card. */
  footer?: React.ReactNode;
}) {
  const [siteName, brandAssets] = await Promise.all([getSetting("site.name"), getBrandAssets()]);

  return (
    // `isolate` alongside `relative`: without a stacking context the motif's
    // -z-10 puts it BEHIND this element's own bg-glow-primary rather than
    // between the glow and the card.
    <main className="bg-glow-primary container-page section-lg relative isolate flex flex-1 items-center justify-center overflow-hidden">
      <AmbientMotif variant="currency" intensity={0.8} />
      <Reveal variant="scale" className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex justify-center">
          <BrandLogo
            light={brandAssets.logo_light?.url ?? null}
            dark={brandAssets.logo_dark?.url ?? null}
            alt={siteName ?? ""}
            className="h-14"
            fallback={<span className="text-lg font-semibold tracking-tight">{siteName}</span>}
          />
        </div>
        <div className="flex flex-col gap-6 rounded-xl border bg-card p-8 shadow-card">
          <div className="flex flex-col gap-1.5">
            <h1 className="text-xl font-semibold">{title}</h1>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
          {children}
          {footer}
        </div>
      </Reveal>
    </main>
  );
}

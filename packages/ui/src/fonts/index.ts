// Curated self-hosted fonts (ADR-005). @repo/theme owns the REGISTRY
// (CURATED_FONTS keys); this file fulfils @repo/ui's side of the contract:
// for every non-"system" key, a next/font/local family whose CSS variable
// is named exactly `--font-{key}`. The engine's emitted
// `--brand-font-sans: var(--font-{key})` resolves against these.
//
// Files come from @fontsource packages (OFL-1.1, real font binaries pulled
// through the same supply-chain-guarded registry as every other dep) —
// next/font/local inlines and self-hosts them at build; no runtime request
// ever leaves our origin. `preload: false` everywhere EXCEPT Inter: ten
// families are declared but only the one the active theme references is
// ever used, so eager-preloading all of them would be nine wasted
// downloads per visit. Inter is the exception because ADR-072 made it the
// default — it is the family essentially every render actually uses, so
// preloading it saves a FOUT rather than wasting a request.
import localFont from "next/font/local";

// The brand typeface (ADR-072, superseding ADR-039's Outfit) —
// DEFAULT_LAYOUT.fontSans resolves to `var(--font-inter)`, so this
// declaration is what every surface renders in unless a theme row names
// another curated family.
const inter = localFont({
  src: "../../node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2",
  weight: "100 900",
  variable: "--font-inter",
  preload: true,
  fallback: ["sans-serif"],
});

// Still a curated key an admin may have picked (ADR-072 deletes no choice),
// so its family stays declared — just no longer preloaded.
const outfit = localFont({
  src: "../../node_modules/@fontsource-variable/outfit/files/outfit-latin-wght-normal.woff2",
  weight: "100 900",
  variable: "--font-outfit",
  preload: false,
  fallback: ["sans-serif"],
});

const roboto = localFont({
  src: "../../node_modules/@fontsource-variable/roboto/files/roboto-latin-wght-normal.woff2",
  weight: "100 900",
  variable: "--font-roboto",
  preload: false,
  fallback: ["sans-serif"],
});

const opensans = localFont({
  src: "../../node_modules/@fontsource-variable/open-sans/files/open-sans-latin-wght-normal.woff2",
  weight: "300 800",
  variable: "--font-opensans",
  preload: false,
  fallback: ["sans-serif"],
});

const lato = localFont({
  src: [
    {
      path: "../../node_modules/@fontsource/lato/files/lato-latin-400-normal.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../node_modules/@fontsource/lato/files/lato-latin-700-normal.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-lato",
  preload: false,
  fallback: ["sans-serif"],
});

const montserrat = localFont({
  src: "../../node_modules/@fontsource-variable/montserrat/files/montserrat-latin-wght-normal.woff2",
  weight: "100 900",
  variable: "--font-montserrat",
  preload: false,
  fallback: ["sans-serif"],
});

const poppins = localFont({
  src: [
    {
      path: "../../node_modules/@fontsource/poppins/files/poppins-latin-400-normal.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../node_modules/@fontsource/poppins/files/poppins-latin-500-normal.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "../../node_modules/@fontsource/poppins/files/poppins-latin-600-normal.woff2",
      weight: "600",
      style: "normal",
    },
    {
      path: "../../node_modules/@fontsource/poppins/files/poppins-latin-700-normal.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-poppins",
  preload: false,
  fallback: ["sans-serif"],
});

const jetbrainsmono = localFont({
  src: "../../node_modules/@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2",
  weight: "100 800",
  variable: "--font-jetbrainsmono",
  preload: false,
  fallback: ["monospace"],
});

const firacode = localFont({
  src: "../../node_modules/@fontsource-variable/fira-code/files/fira-code-latin-wght-normal.woff2",
  weight: "300 700",
  variable: "--font-firacode",
  preload: false,
  fallback: ["monospace"],
});

const ibmplexmono = localFont({
  src: [
    {
      path: "../../node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-600-normal.woff2",
      weight: "600",
      style: "normal",
    },
  ],
  variable: "--font-ibmplexmono",
  preload: false,
  fallback: ["monospace"],
});

/**
 * Every curated family's CSS-variable class, joined — root layouts put this
 * on <html> so whichever family the active theme's --brand-font-sans/-mono
 * references actually resolves. "system"/"systemmono" need no entry: the
 * engine emits their literal stacks directly (ADR-005).
 */
export const curatedFontVariables = [
  outfit.variable,
  inter.variable,
  roboto.variable,
  opensans.variable,
  lato.variable,
  montserrat.variable,
  poppins.variable,
  jetbrainsmono.variable,
  firacode.variable,
  ibmplexmono.variable,
].join(" ");

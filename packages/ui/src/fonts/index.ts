// Curated self-hosted fonts (ADR-005). @repo/theme owns the REGISTRY
// (CURATED_FONTS keys); this file fulfils @repo/ui's side of the contract:
// for every non-"system" key, a next/font/local family whose CSS variable
// is named exactly `--font-{key}`. The engine's emitted
// `--brand-font-sans: var(--font-{key})` resolves against these.
//
// Files come from @fontsource packages (OFL-1.1, real font binaries pulled
// through the same supply-chain-guarded registry as every other dep) —
// next/font/local inlines and self-hosts them at build; no runtime request
// ever leaves our origin. `preload: false` everywhere: ten
// families are declared but only the one the active theme references is
// ever used. Inter was preloaded while it was the default (ADR-072); ADR-140
// made the default the system face, which has no file, so preloading Inter
// would now be a wasted request on every visit.
import localFont from "next/font/local";

// The brand typeface under ADR-072, and still a curated key after ADR-140
// moved the default to the system face.
const inter = localFont({
  src: "../../node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2",
  weight: "100 900",
  variable: "--font-inter",
  preload: false,
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

// The display serifs (ADR-102). `fontDisplay` picks from these; a site that
// wants no serif points that slot at a sans key instead.
//
// Each is the WEIGHT-axis subset, not the all-axes file. Fraunces also carries
// an optical-size axis browsers would apply for free, but only from a 121 KB
// file against 36.6 KB for weight alone — 84 KB on a public route, more than
// Inter's whole face, for an effect no reader can name (ADR-102 §1).
//
// `preload: false` like every non-Inter family: the file is requested only if
// the rendered --brand-font-display actually points at it.
const fraunces = localFont({
  src: "../../node_modules/@fontsource-variable/fraunces/files/fraunces-latin-wght-normal.woff2",
  weight: "100 900",
  variable: "--font-fraunces",
  preload: false,
  fallback: ["serif"],
});

const playfair = localFont({
  src: "../../node_modules/@fontsource-variable/playfair-display/files/playfair-display-latin-wght-normal.woff2",
  weight: "400 900",
  variable: "--font-playfair",
  preload: false,
  fallback: ["serif"],
});

const cormorant = localFont({
  src: "../../node_modules/@fontsource-variable/cormorant-garamond/files/cormorant-garamond-latin-wght-normal.woff2",
  weight: "300 700",
  variable: "--font-cormorant",
  preload: false,
  fallback: ["serif"],
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
  fraunces.variable,
  playfair.variable,
  cormorant.variable,
  jetbrainsmono.variable,
  firacode.variable,
  ibmplexmono.variable,
].join(" ");

// The shared engine behind the site's generated vector art (ADR-051 §5).
//
// Extracted from `generate-about-art.mjs` when the homepage needed the same
// artwork system (`generate-home-art.mjs`). Nothing about the output changed:
// the palette, the PRNG, the scaffolding and every motif are the same code
// they were, and because each piece is seeded from its own file name, the
// About set re-emits byte-identical after the move. A diff there would mean a
// real change, which is exactly the property the seeding exists to give.
//
// This module writes no files and runs no side effects on import — that is
// what makes it safe for two generators to share. Each generator owns its own
// output directory and its own piece list.
/**
 * The art palette. Mirrors the theme's brand hue; see the header note.
 *
 * The no-hex rule is disabled for these nine lines only, on the same grounds
 * `@repo/theme` disables it for its own defaults: the rule's remedy — "use a
 * semantic token instead" — is unavailable here. These values are written into
 * standalone .svg FILES, and a file referenced by `<img src>` or `mask-image`
 * is a separate document that cannot read the page's custom properties. There
 * is no token to reach for; there is only a literal or no artwork.
 *
 * The containment is the point: every colour in eighteen files comes from this
 * one object, nothing below it hardcodes a value, and the re-enable two lines
 * on keeps the rest of the generator under the rule.
 */
/* eslint-disable no-restricted-syntax -- see above: an external SVG cannot read a CSS custom property. */
const PALETTE = {
  ink: "#14110E",
  inkSoft: "#221C16",
  inkLift: "#2E251C",
  brand: "#E8B98C",
  brandDeep: "#C8945F",
  brandDark: "#7A5D42",
  cool: "#7FA3C4",
  coolDeep: "#3F5B75",
  paper: "#F5EFE8",
};
/* eslint-enable no-restricted-syntax */

// ---------------------------------------------------------------------------
// Deterministic randomness. mulberry32 over a string hash of the piece's name:
// same name, same picture, forever.
// ---------------------------------------------------------------------------
function makeRandom(seedText) {
  let h = 2166136261;
  for (const ch of seedText) {
    h ^= ch.codePointAt(0);
    h = Math.imul(h, 16777619);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const round = (n) => Math.round(n * 100) / 100;

// ---------------------------------------------------------------------------
// Shared scaffolding: gradient ground, ambient glows, measurement grid,
// vignette. Every piece is this plus one motif.
// ---------------------------------------------------------------------------
function defs(id) {
  return `<defs>
<linearGradient id="g-${id}" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="${PALETTE.inkLift}"/>
<stop offset=".55" stop-color="${PALETTE.inkSoft}"/>
<stop offset="1" stop-color="${PALETTE.ink}"/>
</linearGradient>
<radialGradient id="warm-${id}" cx=".5" cy=".5" r=".5">
<stop offset="0" stop-color="${PALETTE.brand}" stop-opacity=".55"/>
<stop offset="1" stop-color="${PALETTE.brand}" stop-opacity="0"/>
</radialGradient>
<radialGradient id="cool-${id}" cx=".5" cy=".5" r=".5">
<stop offset="0" stop-color="${PALETTE.cool}" stop-opacity=".38"/>
<stop offset="1" stop-color="${PALETTE.cool}" stop-opacity="0"/>
</radialGradient>
<linearGradient id="fade-${id}" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="${PALETTE.brand}" stop-opacity=".5"/>
<stop offset="1" stop-color="${PALETTE.brand}" stop-opacity="0"/>
</linearGradient>
<pattern id="grid-${id}" width="64" height="64" patternUnits="userSpaceOnUse">
<path d="M64 0H0V64" fill="none" stroke="${PALETTE.paper}" stroke-opacity=".05" stroke-width="1"/>
</pattern>
<radialGradient id="vig-${id}" cx=".5" cy=".45" r=".75">
<stop offset=".55" stop-color="${PALETTE.ink}" stop-opacity="0"/>
<stop offset="1" stop-color="${PALETTE.ink}" stop-opacity=".42"/>
</radialGradient>
</defs>`;
}

function ground(id, w, h, rnd) {
  const blobs = [];
  for (let i = 0; i < 3; i += 1) {
    const cx = round(w * (0.15 + rnd() * 0.7));
    const cy = round(h * (0.1 + rnd() * 0.8));
    const r = round(Math.min(w, h) * (0.35 + rnd() * 0.35));
    const tint = i === 1 ? `cool-${id}` : `warm-${id}`;
    blobs.push(
      `<ellipse cx="${cx}" cy="${cy}" rx="${r}" ry="${round(r * 0.78)}" fill="url(#${tint})"/>`,
    );
  }
  return `<rect width="${w}" height="${h}" fill="url(#g-${id})"/>${blobs.join("")}<rect width="${w}" height="${h}" fill="url(#grid-${id})"/>`;
}

const vignette = (id, w, h) => `<rect width="${w}" height="${h}" fill="url(#vig-${id})"/>`;

// ---------------------------------------------------------------------------
// Motifs. Each returns markup drawn inside a w×h box; each is a recognisable
// picture of the thing its section talks about, not decoration for its own
// sake — a candlestick series for market data, a signed shield for security,
// a mentor orbit for support.
// ---------------------------------------------------------------------------
const MOTIFS = {
  /** Candlestick series with a moving average through it. */
  candles(w, h, rnd) {
    const count = 20;
    const pad = w * 0.12;
    const step = (w - pad * 2) / count;
    const mid = h * 0.5;
    let price = mid;
    const parts = [];
    const line = [];
    for (let i = 0; i < count; i += 1) {
      const x = round(pad + step * (i + 0.5));
      const drift = (rnd() - 0.46) * h * 0.13;
      const open = price;
      const close = Math.max(h * 0.16, Math.min(h * 0.84, price + drift));
      price = close;
      const high = round(Math.min(open, close) - rnd() * h * 0.05);
      const low = round(Math.max(open, close) + rnd() * h * 0.05);
      const up = close < open;
      const colour = up ? PALETTE.brand : PALETTE.coolDeep;
      const bodyTop = round(Math.min(open, close));
      const bodyH = round(Math.max(16, Math.abs(close - open)));
      parts.push(
        `<rect x="${round(x - step * 0.22)}" y="${high}" width="${round(step * 0.44)}" height="${round(low - high)}" rx="${round(step * 0.22)}" fill="${colour}" fill-opacity=".35"/>`,
        `<rect x="${round(x - step * 0.3)}" y="${bodyTop}" width="${round(step * 0.6)}" height="${bodyH}" rx="4" fill="${colour}" fill-opacity="${up ? ".92" : ".6"}"/>`,
      );
      line.push(`${x},${round(close)}`);
    }
    return `${parts.join("")}<polyline points="${line.join(" ")}" fill="none" stroke="${PALETTE.paper}" stroke-opacity=".4" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`;
  },

  /** An area chart with a marked point — "here is what happened, after it happened". */
  line(w, h, rnd) {
    const count = 18;
    const pad = w * 0.09;
    const step = (w - pad * 2) / (count - 1);
    const pts = [];
    let y = h * 0.62;
    for (let i = 0; i < count; i += 1) {
      y = Math.max(h * 0.22, Math.min(h * 0.8, y + (rnd() - 0.55) * h * 0.12));
      pts.push([round(pad + step * i), round(y)]);
    }
    const path = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0]} ${p[1]}`).join(" ");
    const area = `${path} L${pts.at(-1)[0]} ${h} L${pts[0][0]} ${h} Z`;
    const mark = pts[Math.floor(count * 0.66)];
    return `<path d="${area}" fill="url(#fade-${"x"})" fill-opacity=".9"/>
<path d="${path}" fill="none" stroke="${PALETTE.brand}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
<line x1="${mark[0]}" y1="${round(h * 0.12)}" x2="${mark[0]}" y2="${mark[1]}" stroke="${PALETTE.paper}" stroke-opacity=".3" stroke-width="2" stroke-dasharray="8 8"/>
<circle cx="${mark[0]}" cy="${mark[1]}" r="14" fill="${PALETTE.brand}" fill-opacity=".25"/>
<circle cx="${mark[0]}" cy="${mark[1]}" r="7" fill="${PALETTE.paper}"/>`;
  },

  /** A node graph — many sources resolving into one. */
  network(w, h, rnd) {
    const nodes = [];
    for (let i = 0; i < 13; i += 1) {
      nodes.push([round(w * (0.12 + rnd() * 0.76)), round(h * (0.14 + rnd() * 0.72))]);
    }
    const hub = [round(w * 0.5), round(h * 0.5)];
    const edges = nodes
      .map(
        (n) =>
          `<line x1="${hub[0]}" y1="${hub[1]}" x2="${n[0]}" y2="${n[1]}" stroke="${PALETTE.paper}" stroke-opacity=".16" stroke-width="1.5"/>`,
      )
      .join("");
    const dots = nodes
      .map((n, i) => {
        const r = 6 + (i % 3) * 4;
        const c = i % 4 === 0 ? PALETTE.cool : PALETTE.brand;
        return `<circle cx="${n[0]}" cy="${n[1]}" r="${r + 10}" fill="${c}" fill-opacity=".12"/><circle cx="${n[0]}" cy="${n[1]}" r="${r}" fill="${c}" fill-opacity=".85"/>`;
      })
      .join("");
    return `${edges}${dots}<circle cx="${hub[0]}" cy="${hub[1]}" r="46" fill="${PALETTE.brand}" fill-opacity=".16"/><circle cx="${hub[0]}" cy="${hub[1]}" r="26" fill="${PALETTE.brand}"/>`;
  },

  /** A shield with a check — the security pages. */
  shield(w, h) {
    const cx = w / 2;
    const cy = h / 2;
    const s = Math.min(w, h) * 0.34;
    const d = `M${round(cx)} ${round(cy - s * 1.18)} L${round(cx + s)} ${round(cy - s * 0.72)} L${round(cx + s)} ${round(cy + s * 0.16)} Q${round(cx + s)} ${round(cy + s * 0.95)} ${round(cx)} ${round(cy + s * 1.24)} Q${round(cx - s)} ${round(cy + s * 0.95)} ${round(cx - s)} ${round(cy + s * 0.16)} L${round(cx - s)} ${round(cy - s * 0.72)} Z`;
    const tick = `M${round(cx - s * 0.38)} ${round(cy + s * 0.04)} L${round(cx - s * 0.08)} ${round(cy + s * 0.34)} L${round(cx + s * 0.44)} ${round(cy - s * 0.36)}`;
    return `<path d="${d}" fill="${PALETTE.brand}" fill-opacity=".14" stroke="${PALETTE.brand}" stroke-opacity=".55" stroke-width="3"/>
<path d="${d}" fill="none" stroke="${PALETTE.paper}" stroke-opacity=".1" stroke-width="18" transform="translate(0 6)"/>
<path d="${tick}" fill="none" stroke="${PALETTE.brand}" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/>`;
  },

  /** Stacked layers with a key — data held, minimally. */
  layers(w, h) {
    const cx = w / 2;
    const cy = h / 2;
    const rx = Math.min(w, h) * 0.42;
    const ry = rx * 0.3;
    const gap = Math.min(w, h) * 0.14;
    const plates = [2, 1, 0]
      .map((i) => {
        const y = cy + (i - 1) * gap;
        return `<ellipse cx="${round(cx)}" cy="${round(y)}" rx="${round(rx)}" ry="${round(ry)}" fill="${PALETTE.inkLift}" stroke="${PALETTE.brand}" stroke-opacity="${0.28 + i * 0.14}" stroke-width="3"/>`;
      })
      .join("");
    return `${plates}<circle cx="${round(cx)}" cy="${round(cy - gap)}" r="${round(ry * 0.42)}" fill="${PALETTE.brand}" fill-opacity=".9"/>`;
  },

  /** A bar series climbing — figures and strength. */
  bars(w, h, rnd) {
    const count = 9;
    const pad = w * 0.14;
    const step = (w - pad * 2) / count;
    const base = h * 0.8;
    return Array.from({ length: count }, (_, i) => {
      const grow = (i + 1) / count;
      const bh = round(h * 0.5 * (grow * 0.75 + rnd() * 0.25));
      const x = round(pad + step * i + step * 0.16);
      const c = i >= count - 3 ? PALETTE.brand : PALETTE.brandDark;
      return `<rect x="${x}" y="${round(base - bh)}" width="${round(step * 0.68)}" height="${bh}" rx="10" fill="${c}" fill-opacity="${i >= count - 3 ? ".9" : ".45"}"/>`;
    }).join("");
  },

  /** A dashboard abstraction — the platform and its tools. */
  dashboard(w, h, rnd) {
    const x = w * 0.14;
    const y = h * 0.18;
    const bw = w * 0.72;
    const bh = h * 0.64;
    const rows = Array.from({ length: 5 }, (_, i) => {
      const ry = round(y + bh * 0.34 + i * bh * 0.12);
      const rw = round(bw * (0.24 + rnd() * 0.5));
      return `<rect x="${round(x + bw * 0.06)}" y="${ry}" width="${rw}" height="10" rx="5" fill="${PALETTE.paper}" fill-opacity=".18"/>`;
    }).join("");
    const spark = Array.from({ length: 12 }, (_, i) => {
      const sx = round(x + bw * 0.56 + i * bw * 0.032);
      const sh = round(bh * (0.08 + rnd() * 0.3));
      return `<rect x="${sx}" y="${round(y + bh * 0.78 - sh)}" width="${round(bw * 0.02)}" height="${sh}" rx="4" fill="${PALETTE.brand}" fill-opacity=".75"/>`;
    }).join("");
    return `<rect x="${round(x)}" y="${round(y)}" width="${round(bw)}" height="${round(bh)}" rx="26" fill="${PALETTE.ink}" fill-opacity=".6" stroke="${PALETTE.paper}" stroke-opacity=".14" stroke-width="2"/>
<rect x="${round(x)}" y="${round(y)}" width="${round(bw)}" height="${round(bh * 0.16)}" rx="26" fill="${PALETTE.paper}" fill-opacity=".07"/>
<circle cx="${round(x + bw * 0.06)}" cy="${round(y + bh * 0.08)}" r="7" fill="${PALETTE.brand}" fill-opacity=".8"/>
<circle cx="${round(x + bw * 0.1)}" cy="${round(y + bh * 0.08)}" r="7" fill="${PALETTE.paper}" fill-opacity=".22"/>
${rows}${spark}`;
  },

  /** Two streams meeting a bar — where the money comes from. */
  flow(w, h) {
    const midY = h * 0.5;
    const left = w * 0.12;
    const right = w * 0.86;
    const a = `M${round(left)} ${round(h * 0.28)} C${round(w * 0.42)} ${round(h * 0.28)} ${round(w * 0.46)} ${round(midY)} ${round(right)} ${round(midY)}`;
    const b = `M${round(left)} ${round(h * 0.72)} C${round(w * 0.42)} ${round(h * 0.72)} ${round(w * 0.46)} ${round(midY)} ${round(right)} ${round(midY)}`;
    return `<path d="${a}" fill="none" stroke="${PALETTE.brand}" stroke-opacity=".7" stroke-width="26" stroke-linecap="round"/>
<path d="${b}" fill="none" stroke="${PALETTE.coolDeep}" stroke-opacity=".7" stroke-width="18" stroke-linecap="round"/>
<circle cx="${round(left)}" cy="${round(h * 0.28)}" r="20" fill="${PALETTE.brand}"/>
<circle cx="${round(left)}" cy="${round(h * 0.72)}" r="16" fill="${PALETTE.cool}"/>
<rect x="${round(right - 22)}" y="${round(midY - h * 0.2)}" width="44" height="${round(h * 0.4)}" rx="22" fill="${PALETTE.paper}" fill-opacity=".85"/>`;
  },

  /** A mentor at the centre of an orbit of learners. */
  orbit(w, h, rnd) {
    const cx = w / 2;
    const cy = h / 2;
    const rings = [0.24, 0.36, 0.48]
      .map(
        (k) =>
          `<circle cx="${round(cx)}" cy="${round(cy)}" r="${round(Math.min(w, h) * k)}" fill="none" stroke="${PALETTE.paper}" stroke-opacity=".13" stroke-width="2"/>`,
      )
      .join("");
    const people = Array.from({ length: 9 }, (_, i) => {
      const k = [0.24, 0.36, 0.48][i % 3];
      const angle = rnd() * Math.PI * 2;
      const px = round(cx + Math.cos(angle) * Math.min(w, h) * k);
      const py = round(cy + Math.sin(angle) * Math.min(w, h) * k);
      const c = i % 3 === 0 ? PALETTE.cool : PALETTE.brand;
      return `<circle cx="${px}" cy="${py}" r="26" fill="${c}" fill-opacity=".14"/><circle cx="${px}" cy="${round(py - 5)}" r="9" fill="${c}" fill-opacity=".9"/><path d="M${round(px - 14)} ${round(py + 18)} a14 14 0 0 1 28 0" fill="${c}" fill-opacity=".9"/>`;
    }).join("");
    return `${rings}<circle cx="${round(cx)}" cy="${round(cy)}" r="52" fill="${PALETTE.brand}" fill-opacity=".18"/><circle cx="${round(cx)}" cy="${round(cy - 10)}" r="17" fill="${PALETTE.brand}"/><path d="M${round(cx - 27)} ${round(cy + 34)} a27 27 0 0 1 54 0" fill="${PALETTE.brand}"/>${people}`;
  },

  /** Speech bubbles — support, answered by a person. */
  bubbles(w, h) {
    const bubble = (x, y, bw, bh, c, o) =>
      `<rect x="${round(x)}" y="${round(y)}" width="${round(bw)}" height="${round(bh)}" rx="${round(bh * 0.34)}" fill="${c}" fill-opacity="${o}"/>`;
    return `${bubble(w * 0.12, h * 0.24, w * 0.46, h * 0.22, PALETTE.paper, 0.16)}
${bubble(w * 0.34, h * 0.52, w * 0.5, h * 0.24, PALETTE.brand, 0.85)}
<rect x="${round(w * 0.18)}" y="${round(h * 0.31)}" width="${round(w * 0.26)}" height="10" rx="5" fill="${PALETTE.paper}" fill-opacity=".4"/>
<rect x="${round(w * 0.18)}" y="${round(h * 0.36)}" width="${round(w * 0.18)}" height="10" rx="5" fill="${PALETTE.paper}" fill-opacity=".26"/>
<rect x="${round(w * 0.4)}" y="${round(h * 0.6)}" width="${round(w * 0.32)}" height="10" rx="5" fill="${PALETTE.ink}" fill-opacity=".45"/>
<rect x="${round(w * 0.4)}" y="${round(h * 0.65)}" width="${round(w * 0.22)}" height="10" rx="5" fill="${PALETTE.ink}" fill-opacity=".3"/>`;
  },

  /** A dial at three quarters — tools and calculators. */
  gauge(w, h) {
    const cx = w / 2;
    const cy = h * 0.6;
    const r = Math.min(w, h) * 0.32;
    const arc = (from, to, colour, width, opacity) => {
      const p = (deg) => [
        round(cx + Math.cos((deg * Math.PI) / 180) * r),
        round(cy + Math.sin((deg * Math.PI) / 180) * r),
      ];
      const [x1, y1] = p(from);
      const [x2, y2] = p(to);
      const large = to - from > 180 ? 1 : 0;
      return `<path d="M${x1} ${y1} A${round(r)} ${round(r)} 0 ${large} 1 ${x2} ${y2}" fill="none" stroke="${colour}" stroke-opacity="${opacity}" stroke-width="${width}" stroke-linecap="round"/>`;
    };
    const needle = 160 + 0.72 * 220;
    return `${arc(160, 380, PALETTE.paper, 22, 0.12)}${arc(160, needle, PALETTE.brand, 22, 0.92)}
<line x1="${round(cx)}" y1="${round(cy)}" x2="${round(cx + Math.cos((needle * Math.PI) / 180) * r * 0.72)}" y2="${round(cy + Math.sin((needle * Math.PI) / 180) * r * 0.72)}" stroke="${PALETTE.paper}" stroke-width="8" stroke-linecap="round"/>
<circle cx="${round(cx)}" cy="${round(cy)}" r="16" fill="${PALETTE.paper}"/>`;
  },

  /** A globe of meridians — the section opener. */
  globe(w, h) {
    const cx = w / 2;
    const cy = h / 2;
    const r = Math.min(w, h) * 0.38;
    const meridians = [0.28, 0.6, 0.88]
      .flatMap((k) => [
        `<ellipse cx="${round(cx)}" cy="${round(cy)}" rx="${round(r * k)}" ry="${round(r)}" fill="none" stroke="${PALETTE.brand}" stroke-opacity=".3" stroke-width="2"/>`,
      ])
      .join("");
    const parallels = [-0.62, -0.32, 0, 0.32, 0.62]
      .map((k) => {
        const y = round(cy + r * k);
        const half = round(Math.sqrt(Math.max(0, 1 - k * k)) * r);
        return `<line x1="${round(cx - half)}" y1="${y}" x2="${round(cx + half)}" y2="${y}" stroke="${PALETTE.brand}" stroke-opacity=".22" stroke-width="2"/>`;
      })
      .join("");
    return `<circle cx="${round(cx)}" cy="${round(cy)}" r="${round(r)}" fill="${PALETTE.brand}" fill-opacity=".07" stroke="${PALETTE.brand}" stroke-opacity=".45" stroke-width="3"/>${meridians}${parallels}`;
  },

  /**
   * A curriculum: milestone nodes climbing a connected path — the learning
   * section. Distinct from `bars` (which is a quantity) and from `orbit`
   * (which is people): this one is a route through material.
   */
  path(w, h, rnd) {
    const count = 5;
    const padX = w * 0.14;
    const step = (w - padX * 2) / (count - 1);
    const nodes = Array.from({ length: count }, (_, i) => [
      round(padX + step * i),
      round(h * (0.74 - i * 0.11) + (rnd() - 0.5) * h * 0.05),
    ]);
    const line = nodes
      .map((n, i) => {
        if (i === 0) return `M${n[0]} ${n[1]}`;
        const previous = nodes[i - 1];
        const mx = round((previous[0] + n[0]) / 2);
        return `C${mx} ${previous[1]} ${mx} ${n[1]} ${n[0]} ${n[1]}`;
      })
      .join(" ");
    const marks = nodes
      .map(([x, y], i) => {
        const done = i < count - 2;
        const c = done ? PALETTE.brand : PALETTE.cool;
        return `<circle cx="${x}" cy="${y}" r="34" fill="${c}" fill-opacity=".14"/><circle cx="${x}" cy="${y}" r="18" fill="${c}" fill-opacity="${done ? ".95" : ".55"}"/><rect x="${round(x - 34)}" y="${round(y + 42)}" width="68" height="9" rx="4.5" fill="${PALETTE.paper}" fill-opacity=".2"/>`;
      })
      .join("");
    return `<path d="${line}" fill="none" stroke="${PALETTE.paper}" stroke-opacity=".22" stroke-width="6" stroke-linecap="round"/>${marks}`;
  },

  /** A month grid with a few dates flagged — the economic calendar. */
  calendar(w, h, rnd) {
    const cols = 7;
    const rows = 4;
    const bw = w * 0.66;
    const bh = h * 0.62;
    const x0 = (w - bw) / 2;
    const y0 = h * 0.24;
    const cw = bw / cols;
    const ch = bh / rows;
    const heads = Array.from(
      { length: cols },
      (_, c) =>
        `<rect x="${round(x0 + cw * c + cw * 0.2)}" y="${round(y0 - h * 0.06)}" width="${round(cw * 0.6)}" height="9" rx="4.5" fill="${PALETTE.paper}" fill-opacity=".28"/>`,
    ).join("");
    const cells = [];
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const x = round(x0 + cw * c + cw * 0.1);
        const y = round(y0 + ch * r + ch * 0.1);
        const roll = rnd();
        // Three flagged days, weighted like a real week: mostly quiet, one
        // high-impact release, a couple of medium ones.
        const flag = roll > 0.92 ? "high" : roll > 0.78 ? "mid" : null;
        const fill =
          flag === "high" ? PALETTE.brand : flag === "mid" ? PALETTE.cool : PALETTE.paper;
        const opacity = flag === "high" ? 0.9 : flag === "mid" ? 0.55 : 0.07;
        cells.push(
          `<rect x="${x}" y="${y}" width="${round(cw * 0.8)}" height="${round(ch * 0.8)}" rx="10" fill="${fill}" fill-opacity="${opacity}"/>`,
        );
        if (flag === "high") {
          cells.push(
            `<rect x="${round(x - 6)}" y="${round(y - 6)}" width="${round(cw * 0.8 + 12)}" height="${round(ch * 0.8 + 12)}" rx="14" fill="none" stroke="${PALETTE.brand}" stroke-opacity=".45" stroke-width="3"/>`,
          );
        }
      }
    }
    return `${heads}<rect x="${round(x0 - 18)}" y="${round(y0 - 18)}" width="${round(bw + 36)}" height="${round(bh + 36)}" rx="26" fill="${PALETTE.ink}" fill-opacity=".45" stroke="${PALETTE.paper}" stroke-opacity=".12" stroke-width="2"/>${cells.join("")}`;
  },

  /** Stacked article cards with a lead image block — the news feed. */
  feed(w, h, rnd) {
    const cards = [0, 1, 2]
      .map((i) => {
        const cw = w * (0.58 - i * 0.04);
        const chh = h * 0.2;
        const x = round(w * 0.16 + i * w * 0.05);
        const y = round(h * 0.2 + i * h * 0.22);
        const lead = i === 0;
        const lines = Array.from({ length: 2 }, (_, l) => {
          const lw = round(cw * (0.3 + rnd() * 0.34));
          return `<rect x="${round(x + chh * 1.16)}" y="${round(y + chh * (0.3 + l * 0.28))}" width="${lw}" height="9" rx="4.5" fill="${PALETTE.paper}" fill-opacity="${l === 0 ? ".34" : ".18"}"/>`;
        }).join("");
        return `<rect x="${x}" y="${y}" width="${round(cw)}" height="${round(chh)}" rx="18" fill="${PALETTE.ink}" fill-opacity="${lead ? ".72" : ".5"}" stroke="${PALETTE.paper}" stroke-opacity=".12" stroke-width="2"/>
<rect x="${round(x + chh * 0.18)}" y="${round(y + chh * 0.18)}" width="${round(chh * 0.64)}" height="${round(chh * 0.64)}" rx="12" fill="${lead ? PALETTE.brand : PALETTE.brandDark}" fill-opacity="${lead ? ".9" : ".5"}"/>${lines}`;
      })
      .join("");
    return cards;
  },

  /** An A–Z rail beside definition entries — the glossary. */
  index(w, h, rnd) {
    const railX = w * 0.18;
    const rail = Array.from({ length: 8 }, (_, i) => {
      const y = round(h * 0.22 + i * h * 0.075);
      const active = i === 2;
      return `<rect x="${round(railX)}" y="${y}" width="${active ? 44 : 30}" height="12" rx="6" fill="${active ? PALETTE.brand : PALETTE.paper}" fill-opacity="${active ? ".95" : ".22"}"/>`;
    }).join("");
    const entries = Array.from({ length: 4 }, (_, i) => {
      const y = round(h * 0.24 + i * h * 0.16);
      const termW = round(w * (0.14 + rnd() * 0.1));
      const bodyW = round(w * (0.26 + rnd() * 0.16));
      return `<rect x="${round(w * 0.34)}" y="${y}" width="${termW}" height="14" rx="7" fill="${PALETTE.brand}" fill-opacity="${i === 0 ? ".9" : ".55"}"/>
<rect x="${round(w * 0.34)}" y="${round(y + 26)}" width="${bodyW}" height="9" rx="4.5" fill="${PALETTE.paper}" fill-opacity=".24"/>
<rect x="${round(w * 0.34)}" y="${round(y + 41)}" width="${round(bodyW * 0.62)}" height="9" rx="4.5" fill="${PALETTE.paper}" fill-opacity=".14"/>`;
    }).join("");
    return `${rail}${entries}`;
  },
};

// ---------------------------------------------------------------------------
// Canvas sizes. `wide` is a 16:9 page masthead, `callout` the 4:3 box
// SplitCallout uses, `card` the 16:10 box `HomeMedia` uses — each matching its
// consumer exactly, so a real file and the gradient fallback occupy identical
// space and `next/image` never has to crop.
// ---------------------------------------------------------------------------
export const ART_SIZES = {
  wide: { width: 1600, height: 900 },
  callout: { width: 1200, height: 900 },
  card: { width: 1440, height: 900 },
};

/** One finished SVG document: scaffolding, one motif, vignette. */
export function renderArt({ name, motif, size = "callout" }) {
  const { width: w, height: h } = ART_SIZES[size];
  const rnd = makeRandom(name);
  const id = name;
  const body = MOTIFS[motif](w, h, rnd).replaceAll("fade-x", `fade-${id}`);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="presentation" aria-hidden="true">${defs(id)}${ground(id, w, h, rnd)}${body}${vignette(id, w, h)}</svg>\n`;
}

export { PALETTE, makeRandom, round, defs, ground, vignette, MOTIFS };

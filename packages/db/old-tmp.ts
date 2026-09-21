// Temporarily restore the PRE-changes-35 home.sections, to measure the page
// height the composition change actually saved. Reversible: the next sync
// script run puts the new list back.
import { db } from "./src/index.ts";
const OLD = [
  { key: "hero", enabled: true, order: 1, variant: "split" },
  { key: "learning_videos", enabled: false, order: 2, variant: "grid", limit: 6 },
  { key: "trust_strip", enabled: true, order: 3 },
  { key: "facts", enabled: true, order: 4 },
  { key: "explore_platform", enabled: true, order: 5, variant: "carousel" },
  { key: "feature_highlights", enabled: false, order: 6, variant: "grid", limit: 6 },
  { key: "latest_news", enabled: true, order: 7, variant: "split", limit: 5 },
  { key: "latest_analysis", enabled: true, order: 8, variant: "standard", limit: 3 },
  { key: "glossary_spotlight", enabled: true, order: 9, variant: "cards", limit: 8 },
  { key: "popular_tools", enabled: true, order: 11, variant: "default", limit: 4 },
  { key: "connect", enabled: true, order: 14 },
  { key: "testimonials", enabled: true, order: 14, limit: 3 },
  { key: "newsletter", enabled: true, order: 15, variant: "full-width" },
  { key: "faq", enabled: true, order: 16, variant: "accordion", limit: 4 },
  { key: "quotes", enabled: true, order: 17, variant: "single" },
  { key: "risk_disclaimer", enabled: true, order: 18 },
];
await db.setting.update({ where: { key: "home.sections" }, data: { value: OLD } });
console.log("restored the old list");

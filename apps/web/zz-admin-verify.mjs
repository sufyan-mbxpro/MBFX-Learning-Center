// Temporary changes-20 admin verification — deleted after the run.
// Signs in as the seeded admin (password read from .env, never printed),
// then visits every admin screen and reports anatomy + layout problems.
import { readFileSync, mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";

const env = readFileSync("../../.env", "utf8");
const read = (k) => env.match(new RegExp(`^${k}=(.*)$`, "m"))?.[1]?.replace(/^["']|["']$/g, "");
const email = read("SEED_ADMIN_EMAIL") || "admin@mbxpro.com";
const password = read("SEED_ADMIN_PASSWORD");
const SHOTS = process.argv[2];
const width = Number(process.argv[3] ?? 1440);
mkdirSync(SHOTS, { recursive: true });

const BASE = "http://localhost:3000";
const ROUTES = [
  "/keystone/dashboard",
  "/keystone/users",
  "@/keystone/users",
  "/keystone/roles",
  "@/keystone/roles",
  "/keystone/employees",
  "@/keystone/employees",
  "/keystone/articles",
  "@/keystone/articles",
  "/keystone/articles/categories",
  "/keystone/articles/tags",
  "/keystone/glossary",
  "@/keystone/glossary",
  "/keystone/glossary/topics",
  "/keystone/learn/courses",
  "@/keystone/learn/courses",
  "/keystone/learn/lessons",
  "/keystone/learn/quizzes",
  "/keystone/learn/videos",
  "/keystone/learn/progress",
  "/keystone/media",
  "/keystone/settings",
  "@/keystone/settings",
  "/keystone/settings/social",
  "/keystone/features",
  "/keystone/theme",
  "/keystone/profile",
  "/keystone/design-system",
];

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width, height: 900 } });
const page = await context.newPage();
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 160)));
page.on("pageerror", (e) => errors.push(`pageerror: ${String(e).slice(0, 160)}`));

await page.goto(`${BASE}/keystone`, { waitUntil: "load", timeout: 120_000 });
await page.fill('input[type="email"]', email);
await page.fill('input[type="password"]', password);
await page.click('button[type="submit"]');
await page.waitForURL((u) => !u.pathname.includes("sign-in"), { timeout: 120_000 });
console.log(`signed in -> ${new URL(page.url()).pathname}`);

const probe = () =>
  page.evaluate(() => {
    const d = document;
    const vw = d.documentElement.clientWidth;
    const main = d.querySelector("main");
    const header = main?.querySelector("[data-slot=page-header]");
    const h1 = [...d.querySelectorAll("h1")];
    const title = header?.querySelector("h1,h2");
    const desc = header?.querySelector("[data-slot=page-description]");
    const clips = (el) => {
      for (let a = el.parentElement; a && a !== d.body; a = a.parentElement)
        if (getComputedStyle(a).overflowX !== "visible") return true;
      return false;
    };
    const wide = [...d.querySelectorAll("body *")]
      .filter((el) => {
        const b = el.getBoundingClientRect();
        return (
          b.right > vw + 1 && b.width > 0 && getComputedStyle(el).position !== "fixed" && !clips(el)
        );
      })
      .slice(0, 2)
      .map(
        (el) =>
          `${el.tagName}.${(el.getAttribute("class") ?? "").slice(0, 60)}@${Math.round(el.getBoundingClientRect().right)}`,
      );
    // Text cut off inside an overflow-hidden box that is not a deliberate truncation.
    const clipped = [...d.querySelectorAll("main *")]
      .filter((el) => {
        const cs = getComputedStyle(el);
        if (!(cs.overflowX === "hidden" || cs.overflow === "hidden")) return false;
        if (el.scrollWidth <= el.clientWidth + 2 || el.clientWidth === 0) return false;
        if (
          cs.textOverflow === "ellipsis" ||
          /truncate|line-clamp|sr-only|no-scrollbar/.test(el.className)
        )
          return false;
        return (el.innerText ?? "").trim().length > 0;
      })
      .slice(0, 2)
      .map(
        (el) =>
          `${el.tagName}.${String(el.className).slice(0, 50)} +${el.scrollWidth - el.clientWidth}px "${el.innerText.trim().slice(0, 30)}"`,
      );
    const cs = title ? getComputedStyle(title) : null;
    return {
      h1s: h1.length,
      title: title
        ? `${title.tagName} ${cs.fontSize}/${cs.fontWeight} "${title.textContent.trim().slice(0, 30)}"`
        : "NO PAGE HEADER",
      desc: desc ? `${getComputedStyle(desc).fontSize}` : "none",
      overflow: d.documentElement.scrollWidth - vw,
      wide,
      clipped,
      crumbs: d.querySelectorAll("[data-slot=breadcrumb-separator]").length,
    };
  });

for (const r of ROUTES) {
  errors.length = 0;
  let path = r;
  if (r.startsWith("@")) {
    // A detail page: follow the first in-table link from the list page.
    const list = r.slice(1);
    await page.goto(`${BASE}${list}`, { waitUntil: "load", timeout: 120_000 });
    const href = await page.evaluate((list) => {
      const a = [...document.querySelectorAll(`main a[href^="${list}/"]`)].find(
        (el) => !/\/(new|categories|tags|topics|social)$/.test(el.getAttribute("href")),
      );
      return a?.getAttribute("href") ?? null;
    }, list);
    if (!href) {
      console.log(`${r.padEnd(34)} (no detail link found)`);
      continue;
    }
    path = href;
  }
  const res = await page.goto(`${BASE}${path}`, { waitUntil: "load", timeout: 120_000 });
  await page.waitForTimeout(1500);
  const p = await probe();
  const name = path.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "root";
  await page.screenshot({ path: `${SHOTS}/${width}-${name}.png`, fullPage: false });
  const flags = [
    p.h1s !== 1 && `h1s=${p.h1s}`,
    p.overflow > 0 && `OVERFLOW ${p.overflow}px ${p.wide.join(" ")}`,
    p.clipped.length && `CLIPPED ${p.clipped.join(" | ")}`,
    errors.length && `CONSOLE ${[...new Set(errors)].slice(0, 2).join(" || ")}`,
  ].filter(Boolean);
  console.log(
    `${String(res?.status()).padEnd(4)}${path.slice(0, 34).padEnd(35)}${p.title.padEnd(44)} desc ${p.desc.padEnd(5)} crumbs ${p.crumbs}  ${flags.join("  ")}`,
  );
}
await browser.close();

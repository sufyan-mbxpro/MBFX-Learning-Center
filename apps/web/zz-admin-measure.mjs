// Temporary — deleted after the run. Opens one admin route as the seeded
// admin and runs the measurement passed as a function body in argv[3].
// The session is saved once (scratchpad) and reused, so it signs in once.
import { existsSync, readFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const STATE = process.env.ZZ_STATE;
const env = readFileSync("../../.env", "utf8");
const read = (k) => env.match(new RegExp(`^${k}=(.*)$`, "m"))?.[1]?.replace(/^["']|["']$/g, "");
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: Number(process.argv[4] ?? 1440), height: 900 },
  storageState: existsSync(STATE) ? STATE : undefined,
});
const page = await context.newPage();

await page.goto(`http://localhost:3000${process.argv[2]}`, { waitUntil: "networkidle", timeout: 120_000 });
if (new URL(page.url()).pathname.includes("sign-in")) {
  // The form is a client component: fill it only after hydration, or React
  // resets the values and the click submits nothing.
  await page.waitForTimeout(2500);
  await page.fill('input[type="email"]', read("SEED_ADMIN_EMAIL") || "admin@mbxpro.com");
  await page.fill('input[type="password"]', read("SEED_ADMIN_PASSWORD"));
  await Promise.all([
    page.waitForURL((u) => !u.pathname.includes("sign-in"), { timeout: 120_000 }),
    page.click('button[type="submit"]'),
  ]);
  await context.storageState({ path: STATE });
  await page.goto(`http://localhost:3000${process.argv[2]}`, { waitUntil: "networkidle", timeout: 120_000 });
}
await page.waitForTimeout(800);
console.log(JSON.stringify(await page.evaluate(new Function(process.argv[3])), null, 1));
if (process.argv[5]) await page.screenshot({ path: process.argv[5] });
await browser.close();

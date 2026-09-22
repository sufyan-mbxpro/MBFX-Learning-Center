import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { LEARNER_EMAIL, LEARNER_PASSWORD } from "../accounts.ts";
import { waitForHydration } from "../hydration.ts";

// The single-app cross-surface probe (ADR-006 consequence, testing.md #4,
// hardening SKILL.md's launch gate): **a learner session against every
// `/admin/*` route and admin handler → never 200.**
//
// It was the one blocking launch-gate item with no test at all. ADR-006 put
// the public site and the admin portal in ONE Next.js app on ONE origin, and
// named this probe as the price of that: with two apps a learner simply cannot
// reach `/admin`, and with one app the only thing standing between them is
// code we wrote.
//
// A LEARNER, not an anonymous visitor, on purpose. The two are refused by
// different code: anonymous has no session cookie and dies at `proxy.ts`'s
// gate, while a learner holds a valid session and is refused for `userType`
// alone — by the `(admin)` layout's re-check and by every service behind it
// (security.md #3, "two locks"). Only the second can regress silently, and it
// is the one this file exercises. The fixture learner holds NO role, so a
// refusal here can never be mistaken for "missing permission".
//
// Lives in `public/` because it runs in the anonymous project — it must NOT
// inherit the admin storageState.

/**
 * Every routed `/admin` page. Kept as a literal list rather than globbed at
 * runtime: a probe that discovers its own targets stops covering a route the
 * moment the discovery breaks, and reads green while doing it. `admin-surface.
 * test.ts` is what fails when this list and the tree disagree.
 *
 * `[id]`-style segments carry a plausible-looking value. Existence is not the
 * point — a learner must be turned away before the route ever asks whether the
 * row exists, which is also why a 404 from a bad id would be a WEAKER pass
 * than the redirect these assert.
 */
const PLACEHOLDER_ID = "00000000-0000-0000-0000-000000000000";

/**
 * A real 1×1 PNG, magic bytes and all. Uploads validate MIME from the BYTES
 * rather than the client's `File.type` (security.md #9), so a dummy string
 * would be rejected as a bad image — a 400 that says nothing about
 * authorization. This one would be accepted for a permitted subject, which is
 * what makes the refusal meaningful.
 */
const PROBE_PNG = {
  name: "probe.png",
  mimeType: "image/png",
  buffer: Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==",
    "base64",
  ),
};

const ADMIN_PAGES = [
  "/admin",
  "/admin/ai",
  "/admin/settings/ai",
  "/admin/settings/ai/usage",
  "/admin/settings/ai/features",
  "/admin/settings/ai/limits",
  "/admin/settings/ai/providers",
  "/admin/settings/ai/providers/new",
  `/admin/settings/ai/providers/${PLACEHOLDER_ID}`,
  "/admin/articles",
  "/admin/articles/categories",
  "/admin/articles/tags",
  `/admin/articles/${PLACEHOLDER_ID}`,
  "/admin/design-system",
  "/admin/employees",
  `/admin/employees/${PLACEHOLDER_ID}`,
  "/admin/glossary",
  "/admin/glossary/topics",
  `/admin/glossary/${PLACEHOLDER_ID}`,
  "/admin/homepage",
  "/admin/learn/courses",
  "/admin/learn/lessons",
  "/admin/learn/progress",
  "/admin/learn/quizzes",
  "/admin/learn/videos",
  "/admin/learn/videos/categories",
  "/admin/market",
  "/admin/market/provider",
  "/admin/media",
  "/admin/navigation",
  "/admin/newsletter",
  "/admin/profile",
  "/admin/roles",
  "/admin/settings",
  "/admin/settings/email",
  "/admin/settings/email/delivery",
  "/admin/settings/email/newsletter",
  "/admin/settings/email/log",
  "/admin/settings/email/templates",
  "/admin/settings/social",
  "/admin/social",
  "/admin/theme",
  "/admin/tools",
  "/admin/users",
  "/admin/website",
  "/admin/website/pages",
  "/admin/website/redirects",
];

/**
 * Every `/admin/api` route handler, probed with the METHOD it actually
 * implements and a body a permitted caller would be served for.
 *
 * Probing `GET` on a POST-only handler would score a 405 and prove nothing, so
 * the method matters; and a body the schema rejects would score a 400, which
 * also proves nothing about authorization. Each of these is a request that
 * WOULD succeed for the right subject — which is what makes the refusal
 * meaningful.
 */
const ADMIN_HANDLERS: {
  path: string;
  method: "GET" | "POST";
  body?: unknown;
  /** A multipart upload, which is how the three upload handlers are called. */
  multipart?: Record<string, string | { name: string; mimeType: string; buffer: Buffer }>;
}[] = [
  { path: "/admin/api/media?include=facets,recent", method: "GET" },
  { path: "/admin/api/newsletter/export", method: "GET" },
  // ADR-128: the idle watcher's two reads. STAFF-only, no permission key —
  // a learner's session must not learn its own expiry through the admin.
  { path: "/admin/api/session", method: "GET" },
  { path: "/admin/api/session/activity", method: "GET" },
  {
    // POST, not GET — the body is an unsaved draft (ADR-078 #8).
    path: "/admin/api/email/preview",
    method: "POST",
    body: { key: "password_reset", locale: "en" },
  },
  {
    path: "/admin/api/ai/run",
    method: "POST",
    body: { feature: "writing_assistant", action: "improve", input: { text: "probe" } },
  },
  {
    path: "/admin/api/uploads/image",
    method: "POST",
    multipart: { purpose: "article", category: "news", file: PROBE_PNG },
  },
  {
    path: "/admin/api/uploads/media",
    method: "POST",
    multipart: { purpose: "content", category: "general", file: PROBE_PNG },
  },
  {
    // The replace endpoint. The id is a placeholder: a learner must be refused
    // before the route asks whether the asset exists.
    path: `/admin/api/uploads/media/${PLACEHOLDER_ID}`,
    method: "POST",
    multipart: { purpose: "content", category: "general", file: PROBE_PNG },
  },
];

test.describe("a learner session cannot reach the admin portal", () => {
  test.describe.configure({ mode: "serial" });

  // ONE sign-in for the whole file, not one per test.
  //
  // `beforeEach` was what this said, and with ~50 probed paths it meant ~50
  // credential round-trips — several minutes of a suite proving the same
  // session works over and over. Serial mode plus a context created here is
  // the shape that fits: the session under test is a single session, which is
  // also more faithful to the threat than fifty fresh ones.
  //
  // The context is built explicitly with an EMPTY storageState rather than
  // relying on this project having none. The runner applies a project's `use`
  // options to a context made this way — that is how `baseURL` reaches it —
  // so `storageState` would come along too if the project ever gained one.
  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    page = await context.newPage();

    // The LEARNER screen (ADR-052) — the public site names no /admin path, and
    // a learner reaching the portal must not need to have visited one.
    await page.goto("/sign-in");
    await waitForHydration(page, "#signin-email");
    await page.getByLabel("Email", { exact: true }).fill(LEARNER_EMAIL);
    await page.getByLabel("Password", { exact: true }).fill(LEARNER_PASSWORD);
    await Promise.all([
      page.waitForResponse((r) => r.url().includes("/api/auth/sign-in/email")),
      // Scoped to `main`: the signed-out `VisitorCta` band above the footer
      // (ADR-094) offers its own "Sign in", so the bare role query is two
      // elements on this page — and one of them is a link to the page you are
      // already on.
      page.getByRole("main").getByRole("button", { name: "Sign in" }).click(),
    ]);

    // The probe is worthless without this: the whole point is a subject who IS
    // signed in. An assertion that /admin refuses a session that does not
    // exist tests nothing.
    const session = await page.request.get("/api/auth/get-session");
    expect(session.status(), "the learner must hold a real session").toBe(200);
    expect(await session.text(), "…with a user on it").toContain(LEARNER_EMAIL);
  });

  test.afterAll(async () => {
    await context?.close();
  });

  // Re-asserted before each probe, cheaply: a page that signed the learner out
  // (or a session that expired mid-run) would make every remaining assertion
  // pass for the wrong reason.
  test.beforeEach(async () => {
    const session = await page.request.get("/api/auth/get-session");
    expect(await session.text(), "the learner's session went away mid-run").toContain(
      LEARNER_EMAIL,
    );
  });

  for (const path of ADMIN_PAGES) {
    test(`${path} turns the learner away`, async () => {
      await page.goto(path);

      // Not "some status code": the learner must not END UP on an admin page.
      // `goto` follows the redirect, so the final URL is the assertion — a 200
      // here would be a 200 for the admin shell.
      await expect
        .poll(() => new URL(page.url()).pathname, { timeout: 15_000 })
        .not.toMatch(/^\/admin(?!\/sign-in)/);

      // And nothing of the portal rendered on the way. `AdminShell`'s primary
      // navigation is the tell.
      await expect(page.getByRole("navigation", { name: "Admin" })).toHaveCount(0);
    });
  }

  for (const { path, method, body, multipart } of ADMIN_HANDLERS) {
    test(`${method} ${path} refuses the learner`, async () => {
      // `page.request` carries the page's cookies, so this is the learner's
      // own session asking — which is the threat, not a bare fetch.
      const response =
        method === "GET"
          ? await page.request.get(path)
          : await page.request.post(path, multipart ? { multipart } : { data: body ?? {} });

      // "Never 200" is the launch gate's own wording, and it is asserted as
      // written: any 2xx is a failure.
      expect(
        response.status(),
        `${method} ${path} answered ${response.status()} to a learner`,
      ).toBeGreaterThanOrEqual(400);

      // Belt and braces — a handler could answer 4xx and still have leaked a
      // body. Nothing shaped like data may come back.
      const text = await response.text();
      expect(text).not.toContain('"assets"');
      expect(text).not.toContain('"subscribers"');
    });
  }
});

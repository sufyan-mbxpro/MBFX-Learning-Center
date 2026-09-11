// changes-11 Phase 2 required tests (ADR-055, ADR-056) against a real
// MariaDB — mocking Prisma here would hide exactly the FK, cascade and
// unique-constraint behaviour these services depend on (testing.md).
//
// Covers the plan §15 rows that are decidable at the service layer: empty
// track suppression, reserved slugs, reorder-changes-no-URL, slug→301,
// transition legality, publish permission, XSS, the capability rule, the
// visibility rule, recommendations ordering, the index payload shape, media
// in-use protection, lessonCount maintenance, and "the server never fetches
// an external URL".
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { MariaDbContainer, type StartedMariaDbContainer } from "@testcontainers/mariadb";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { ContentStatus } from "@repo/db";
import type { LearnTrackKey } from "@repo/contracts";
import type { db as DbClient } from "@repo/db";
import type { Subject } from "@repo/rbac";
import type * as CoursesModule from "./courses.ts";
import type * as SectionsModule from "./course-sections.ts";
import type * as LessonsModule from "./lessons.ts";
import type * as PublicCoursesModule from "./public-courses.ts";
import type * as MediaModule from "./media.ts";

const dbPackageRoot = fileURLToPath(new URL("../../db", import.meta.url));
const prismaCli = createRequire(import.meta.url).resolve("prisma/build/index.js");

let container: StartedMariaDbContainer;
let db: typeof DbClient;
let courses: typeof CoursesModule;
let sections: typeof SectionsModule;
let lessons: typeof LessonsModule;
let publicCourses: typeof PublicCoursesModule;
let media: typeof MediaModule;

let editor: Subject; // courses.* + lessons.* including publish
let assistant: Subject; // everything EXCEPT the publish keys

beforeAll(async () => {
  container = await new MariaDbContainer("mariadb:11.4")
    .withDatabase("mbfx_test")
    .withUsername("test")
    .withUserPassword("test")
    .start();

  const url = container.getConnectionUri().replace(/^mariadb:/, "mysql:");
  execFileSync(process.execPath, [prismaCli, "migrate", "deploy"], {
    cwd: dbPackageRoot,
    env: { ...process.env, DATABASE_URL: url },
    stdio: "pipe",
  });

  process.env.DATABASE_URL = url;
  db = (await import("@repo/db")).db;
  courses = await import("./courses.ts");
  sections = await import("./course-sections.ts");
  lessons = await import("./lessons.ts");
  publicCourses = await import("./public-courses.ts");
  media = await import("./media.ts");

  const user = await db.user.create({
    data: {
      id: crypto.randomUUID(),
      email: "learn-actor@x.com",
      name: "Editor",
      status: "ACTIVE",
      userType: "STAFF",
    },
  });
  editor = {
    id: user.id,
    userType: "STAFF",
    roleKeys: [],
    maxRoleLevel: 60,
    allowed: new Set([
      "courses.view",
      "courses.create",
      "courses.update",
      "courses.delete",
      "courses.publish",
      "lessons.view",
      "lessons.create",
      "lessons.update",
      "lessons.delete",
      "lessons.publish",
    ]),
    denied: new Set(),
  };
  assistant = {
    ...editor,
    allowed: new Set(["courses.update", "lessons.update"]),
  };

  await db.locale.create({
    data: {
      code: "en",
      name: "English",
      nativeName: "English",
      direction: "LTR",
      isDefault: true,
      isActive: true,
      sortOrder: 1,
    },
  });
  await db.locale.create({
    data: {
      code: "es",
      name: "Spanish",
      nativeName: "Español",
      direction: "LTR",
      isActive: false,
      sortOrder: 2,
      fallbackCode: "en",
    },
  });
}, 180_000);

afterAll(async () => {
  await db.$disconnect();
  await container.stop();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── Fixtures ────────────────────────────────────────────────

let fixtureSeq = 0;

/** A published course with one published section and one published lesson. */
async function makeCourse(options?: {
  track?: LearnTrackKey;
  title?: string;
  publish?: boolean;
  visibility?: "PUBLIC" | "AUTHENTICATED" | "PREMIUM";
}): Promise<{ courseId: string; sectionId: string; lessonId: string; slug: string }> {
  fixtureSeq += 1;
  const title = options?.title ?? `Course ${fixtureSeq}`;
  const courseId = await courses.createCourse(editor, {
    track: options?.track ?? "forex",
    title,
  });
  const sectionId = await sections.createSection(editor, courseId, "Section One");
  const lessonId = await lessons.createLesson(editor, {
    sectionId,
    title: `Lesson ${fixtureSeq}`,
  });

  await lessons.saveLesson(editor, {
    lessonId,
    meta: {},
    translation: { locale: "en", title: `Lesson ${fixtureSeq}`, content: "<p>Body.</p>" },
    attachments: [],
  });

  if (options?.visibility && options.visibility !== "PUBLIC") {
    await db.course.update({
      where: { id: courseId },
      data: { visibility: options.visibility },
    });
  }

  if (options?.publish !== false) {
    await db.courseSection.update({ where: { id: sectionId }, data: { isPublished: true } });
    await db.course.update({
      where: { id: courseId },
      data: { status: ContentStatus.PUBLISHED, publishedAt: new Date() },
    });
    await db.lesson.update({
      where: { id: lessonId },
      data: { status: ContentStatus.PUBLISHED, publishedAt: new Date() },
    });
    await db.$transaction(async (tx) => {
      await courses.recomputeLessonCount(tx, courseId);
    });
  }

  const t = await db.courseTranslation.findFirstOrThrow({
    where: { courseId, locale: "en" },
    select: { slug: true },
  });
  return { courseId, sectionId, lessonId, slug: t.slug };
}

// ─── Tracks and the empty-band rule (ADR-055 #2) ─────────────

describe("learn index", () => {
  it("rejects a course on an unregistered track", async () => {
    // `createCourseSchema` already makes this unrepresentable at the contract
    // boundary — the cast is how we reach the service's OWN guard, which is
    // what protects a caller that did not parse first (defence in depth, and
    // the reason `assertTrack` exists at all).
    await expect(
      courses.createCourse(editor, { track: "stocks" as LearnTrackKey, title: "Equities" }),
    ).rejects.toThrow(courses.UnknownTrackError);
  });

  it("omits a track that has no published courses, rather than returning an empty band", async () => {
    await makeCourse({ track: "forex" });
    const groups = await publicCourses.loadLearnIndex("en");

    expect(groups.some((g) => g.track === "forex")).toBe(true);
    // `crypto` is registered in LEARN_TRACKS but has nothing published here.
    // The band must be ABSENT, not present-and-empty — the page renders what
    // this returns, so an empty band cannot be produced by a forgetful template.
    expect(groups.some((g) => g.track === "crypto")).toBe(false);
    for (const group of groups) expect(group.courses.length).toBeGreaterThan(0);
  });

  it("orders track groups by the registry's sortOrder, not by data", async () => {
    await makeCourse({ track: "crypto" });
    const groups = await publicCourses.loadLearnIndex("en");
    const tracks = groups.map((g) => g.track);
    expect(tracks.indexOf("forex")).toBeLessThan(tracks.indexOf("crypto"));
  });

  it("carries curriculum titles but never lesson bodies (ADR-055 #11)", async () => {
    await makeCourse();
    const groups = await publicCourses.loadLearnIndex("en");
    const serialized = JSON.stringify(groups);

    expect(serialized).toContain("Section One");
    expect(serialized).not.toContain("<p>Body.</p>");
    expect(serialized).not.toContain('"content"');
  });
});

// ─── Reserved slugs (ADR-055 #3) ─────────────────────────────

describe("reserved course slugs", () => {
  it("refuses a course whose slug would shadow a static segment", async () => {
    // Both live one level under /learn/<track> (ADR-065 §1), so a course
    // slugged either would be unreachable behind the real route.
    for (const title of ["Quizzes", "Glossary"]) {
      await expect(courses.createCourse(editor, { track: "forex", title })).rejects.toThrow(
        courses.ReservedCourseSlugError,
      );
    }
  });

  it("refuses it on save too, even when the editor left the slug field blank", async () => {
    const { courseId } = await makeCourse();
    // The derived slug is what shadows the route, so the check must run on the
    // DERIVED value — a title-only save is the path that would otherwise slip through.
    await expect(
      courses.saveCourse(editor, {
        courseId,
        meta: {},
        translation: { locale: "en", title: "Quizzes" },
      }),
    ).rejects.toThrow(courses.ReservedCourseSlugError);
  });
});

// ─── URLs survive curriculum edits (ADR-055 #3) ──────────────

describe("URL stability", () => {
  it("changes no lesson URL when sections are reordered", async () => {
    const { courseId, lessonId } = await makeCourse();
    const second = await sections.createSection(editor, courseId, "Section Two");

    const before = await db.lessonTranslation.findFirstOrThrow({
      where: { lessonId, locale: "en" },
      select: { slug: true },
    });

    await sections.reorderSections(editor, courseId, [
      second,
      (
        await db.courseSection.findFirstOrThrow({
          where: { courseId, id: { not: second } },
          select: { id: true },
        })
      ).id,
    ]);

    const after = await db.lessonTranslation.findFirstOrThrow({
      where: { lessonId, locale: "en" },
      select: { slug: true },
    });
    expect(after.slug).toBe(before.slug);
  });

  it("changes no lesson URL when a lesson moves between sections", async () => {
    const { courseId, lessonId } = await makeCourse();
    const target = await sections.createSection(editor, courseId, "Destination");

    const before = await db.lessonTranslation.findFirstOrThrow({
      where: { lessonId, locale: "en" },
      select: { slug: true },
    });
    await lessons.moveLesson(editor, lessonId, target, 0);
    const after = await db.lessonTranslation.findFirstOrThrow({
      where: { lessonId, locale: "en" },
      select: { slug: true },
    });

    expect(after.slug).toBe(before.slug);
    const moved = await db.lesson.findUniqueOrThrow({ where: { id: lessonId } });
    expect(moved.sectionId).toBe(target);
  });

  it("refuses to move a lesson into another course's section", async () => {
    const a = await makeCourse();
    const b = await makeCourse();
    // LessonProgress.courseId is denormalised (ADR-056 #2); a cross-course move
    // would strand every existing progress row against the wrong course.
    await expect(lessons.moveLesson(editor, a.lessonId, b.sectionId, 0)).rejects.toThrow(
      lessons.CrossCourseMoveError,
    );
  });

  it("writes a 301 when a course slug changes", async () => {
    const { courseId, slug } = await makeCourse({ title: "Original Course Name" });
    await courses.saveCourse(editor, {
      courseId,
      meta: {},
      translation: { locale: "en", title: "Original Course Name", slug: "renamed-course" },
    });

    const redirect = await db.redirect.findUnique({
      where: { fromPath: `/learn/forex/${slug}` },
    });
    expect(redirect?.toPath).toBe("/learn/forex/renamed-course");
    expect(redirect?.statusCode).toBe(301);
  });

  // The track is the other half of a course's address (ADR-065 §1), so moving
  // a course between schools has to redirect exactly as a rename does — and
  // has to take the lessons with it.
  it("writes a 301 when a course changes TRACK, and moves its lessons too", async () => {
    const { courseId, lessonId, slug } = await makeCourse({ title: "Moving School" });
    const lessonSlug = (
      await db.lessonTranslation.findFirstOrThrow({
        where: { lessonId, locale: "en" },
        select: { slug: true },
      })
    ).slug;

    await courses.saveCourse(editor, {
      courseId,
      meta: { track: "crypto" },
      translation: { locale: "en", title: "Moving School", slug },
    });

    const course = await db.redirect.findUnique({ where: { fromPath: `/learn/forex/${slug}` } });
    expect(course?.toPath).toBe(`/learn/crypto/${slug}`);

    const lesson = await db.redirect.findUnique({
      where: { fromPath: `/learn/forex/${slug}/${lessonSlug}` },
    });
    expect(lesson?.toPath).toBe(`/learn/crypto/${slug}/${lessonSlug}`);
  });

  it("also redirects every lesson under a renamed course", async () => {
    const { courseId, lessonId, slug } = await makeCourse({ title: "Course With Lessons" });
    const lessonSlug = (
      await db.lessonTranslation.findFirstOrThrow({
        where: { lessonId, locale: "en" },
        select: { slug: true },
      })
    ).slug;

    await courses.saveCourse(editor, {
      courseId,
      meta: {},
      translation: { locale: "en", title: "Course With Lessons", slug: "new-course-path" },
    });

    // A lesson URL embeds the course slug, so a rename moves every lesson too.
    // Without this the course redirects and all its lessons 404 — a failure
    // that is invisible from the page you just renamed.
    const redirect = await db.redirect.findUnique({
      where: { fromPath: `/learn/forex/${slug}/${lessonSlug}` },
    });
    expect(redirect?.toPath).toBe(`/learn/forex/new-course-path/${lessonSlug}`);
  });

  it("writes a 301 when a lesson slug changes", async () => {
    const { lessonId, slug } = await makeCourse();
    const before = (
      await db.lessonTranslation.findFirstOrThrow({
        where: { lessonId, locale: "en" },
        select: { slug: true },
      })
    ).slug;

    await lessons.saveLesson(editor, {
      lessonId,
      meta: {},
      translation: {
        locale: "en",
        title: "Renamed Lesson",
        slug: "renamed-lesson",
        content: "<p>Body.</p>",
      },
      attachments: [],
    });

    const redirect = await db.redirect.findUnique({
      where: { fromPath: `/learn/forex/${slug}/${before}` },
    });
    expect(redirect?.toPath).toBe(`/learn/forex/${slug}/renamed-lesson`);
  });

  it("suffixes a colliding lesson slug rather than failing the save", async () => {
    // Lesson slugs are globally unique per locale (that is what lets the URL
    // omit the section), so a second "Introduction" must be accommodated.
    const a = await makeCourse();
    const b = await makeCourse();
    const first = await lessons.createLesson(editor, {
      sectionId: a.sectionId,
      title: "Introduction",
    });
    const second = await lessons.createLesson(editor, {
      sectionId: b.sectionId,
      title: "Introduction",
    });

    const [ta, tb] = await Promise.all([
      db.lessonTranslation.findFirstOrThrow({ where: { lessonId: first }, select: { slug: true } }),
      db.lessonTranslation.findFirstOrThrow({
        where: { lessonId: second },
        select: { slug: true },
      }),
    ]);
    expect(ta.slug).not.toBe(tb.slug);
  });
});

// ─── Status machine and publish permission ───────────────────

describe("lifecycle", () => {
  it("rejects DRAFT → PUBLISHED without passing review", async () => {
    const { lessonId } = await makeCourse({ publish: false });
    await expect(
      lessons.setLessonStatus(editor, lessonId, ContentStatus.PUBLISHED),
    ).rejects.toThrow(/Illegal content transition/);
  });

  it("rejects publishing without lessons.publish", async () => {
    const { lessonId } = await makeCourse({ publish: false });
    await db.lesson.update({
      where: { id: lessonId },
      data: { status: ContentStatus.APPROVED },
    });
    await expect(
      lessons.setLessonStatus(assistant, lessonId, ContentStatus.PUBLISHED),
    ).rejects.toThrow(/lessons\.publish/);
  });

  it("keeps Course.lessonCount in step with publish and soft delete", async () => {
    const { courseId, sectionId } = await makeCourse();
    const before = await db.course.findUniqueOrThrow({ where: { id: courseId } });
    expect(before.lessonCount).toBe(1);

    const extra = await lessons.createLesson(editor, { sectionId, title: "Second lesson" });
    await db.lesson.update({ where: { id: extra }, data: { status: ContentStatus.APPROVED } });
    await lessons.setLessonStatus(editor, extra, ContentStatus.PUBLISHED);

    const afterPublish = await db.course.findUniqueOrThrow({ where: { id: courseId } });
    expect(afterPublish.lessonCount).toBe(2);

    await lessons.setLessonDeleted(editor, extra, true);
    const afterDelete = await db.course.findUniqueOrThrow({ where: { id: courseId } });
    expect(afterDelete.lessonCount).toBe(1);
  });

  it("refuses to delete a section that still holds lessons", async () => {
    const { sectionId } = await makeCourse();
    // The DB cascades section → lessons, so without this guard one click
    // destroys every lesson, translation and published URL underneath.
    await expect(sections.deleteSection(editor, sectionId)).rejects.toThrow(
      courses.SectionNotEmptyError,
    );
  });

  it("deletes an empty section", async () => {
    const { courseId } = await makeCourse();
    const empty = await sections.createSection(editor, courseId, "Empty");
    await sections.deleteSection(editor, empty);
    expect(await db.courseSection.findUnique({ where: { id: empty } })).toBeNull();
  });
});

// ─── Sanitization (security.md #8) ───────────────────────────

describe("lesson body sanitization", () => {
  it("strips script, event handlers and javascript: URLs on save", async () => {
    const { lessonId } = await makeCourse();
    await lessons.saveLesson(editor, {
      lessonId,
      meta: {},
      translation: {
        locale: "en",
        title: "XSS",
        content:
          '<p>ok</p><script>alert(1)</script><img src="x" onerror="alert(2)">' +
          '<a href="javascript:alert(3)">click</a>',
      },
      attachments: [],
    });

    const stored = await db.lessonTranslation.findFirstOrThrow({
      where: { lessonId, locale: "en" },
      select: { content: true },
    });
    expect(stored.content).toContain("<p>ok</p>");
    expect(stored.content).not.toContain("<script");
    expect(stored.content).not.toContain("onerror");
    expect(stored.content).not.toContain("javascript:");
  });

  it("drops an iframe from a host outside the embed allowlist", async () => {
    const { lessonId } = await makeCourse();
    await lessons.saveLesson(editor, {
      lessonId,
      meta: {},
      translation: {
        locale: "en",
        title: "Iframe",
        content: '<p>x</p><iframe src="https://evil.com/pwn"></iframe>',
      },
      attachments: [],
    });

    const stored = await db.lessonTranslation.findFirstOrThrow({
      where: { lessonId, locale: "en" },
      select: { content: true },
    });
    expect(stored.content).not.toContain("evil.com");
  });
});

// ─── Capabilities (ADR-055 #4) ───────────────────────────────

describe("the capability rule", () => {
  it("refuses a lesson with no capability at all", async () => {
    const { lessonId } = await makeCourse();
    await expect(
      lessons.saveLesson(editor, {
        lessonId,
        meta: { videoUrl: null, externalUrl: null },
        translation: { locale: "en", title: "Empty", content: null },
        attachments: [],
      }),
    ).rejects.toThrow(lessons.EmptyLessonError);
  });

  it("refuses a body that sanitizes down to nothing", async () => {
    const { lessonId } = await makeCourse();
    // The contract sees a non-empty string; only the server sees what is
    // actually stored. This is why the rule is enforced in both places.
    await expect(
      lessons.saveLesson(editor, {
        lessonId,
        meta: { videoUrl: null, externalUrl: null },
        translation: { locale: "en", title: "Empty", content: "<p></p><script>x()</script>" },
        attachments: [],
      }),
    ).rejects.toThrow(lessons.EmptyLessonError);
  });

  it("accepts an external-resource-only lesson", async () => {
    const { lessonId } = await makeCourse();
    await lessons.saveLesson(editor, {
      lessonId,
      meta: { externalUrl: "https://www.bis.org/statistics/rpfx22.htm" },
      translation: { locale: "en", title: "Further reading", content: null },
      attachments: [],
    });
    const stored = await db.lesson.findUniqueOrThrow({ where: { id: lessonId } });
    expect(stored.externalUrl).toBe("https://www.bis.org/statistics/rpfx22.htm");
  });

  it("rejects a video URL from an unsupported provider", async () => {
    const { lessonId } = await makeCourse();
    await expect(
      lessons.saveLesson(editor, {
        lessonId,
        meta: { videoUrl: "https://evil.com/video.mp4" },
        translation: { locale: "en", title: "Video", content: "<p>x</p>" },
        attachments: [],
      }),
    ).rejects.toThrow(lessons.InvalidLessonVideoUrlError);
  });
});

// ─── SSRF (security.md #9, ADR-055 #5) ───────────────────────

describe("external URLs are stored, never fetched", () => {
  it("makes no outbound request while saving or rendering an external lesson", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const { courseId, lessonId, slug } = await makeCourse();

    await lessons.saveLesson(editor, {
      lessonId,
      meta: { externalUrl: "https://example.com/textbook" },
      translation: { locale: "en", title: "External", content: "<p>x</p>" },
      attachments: [],
    });
    await courses.saveCourse(editor, {
      courseId,
      meta: { externalUrl: "https://example.com/course" },
      translation: { locale: "en", title: "External Course" },
    });

    const lessonSlug = (
      await db.lessonTranslation.findFirstOrThrow({
        where: { lessonId, locale: "en" },
        select: { slug: true },
      })
    ).slug;
    await publicCourses.loadCourseBySlug("en", slug);
    await publicCourses.loadLessonBySlug("en", slug, lessonSlug);

    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

// ─── Visibility (ADR-012) ────────────────────────────────────

describe("visibility", () => {
  it("hides an unpublished course from every public loader", async () => {
    const { slug } = await makeCourse({ publish: false });
    expect(await publicCourses.loadCourseBySlug("en", slug)).toBeNull();
  });

  it.each(["AUTHENTICATED", "PREMIUM"] as const)(
    "hides a %s course from the cached public loaders",
    async (visibility) => {
      const { slug } = await makeCourse({ visibility });
      // These loaders run inside "use cache" pages and read no session
      // (ADR-056 #1), so gated rows cannot be served from them at all —
      // ADR-012's conservative direction.
      expect(await publicCourses.loadCourseBySlug("en", slug)).toBeNull();
      const groups = await publicCourses.loadLearnIndex("en");
      expect(JSON.stringify(groups)).not.toContain(slug);
    },
  );

  it("hides an unpublished lesson from the lesson loader", async () => {
    const { lessonId, slug } = await makeCourse();
    const lessonSlug = (
      await db.lessonTranslation.findFirstOrThrow({
        where: { lessonId, locale: "en" },
        select: { slug: true },
      })
    ).slug;
    await db.lesson.update({ where: { id: lessonId }, data: { status: ContentStatus.DRAFT } });

    expect(await publicCourses.loadLessonBySlug("en", slug, lessonSlug)).toBeNull();
  });

  it("keeps unpublished and gated content out of the sitemap", async () => {
    const draft = await makeCourse({ publish: false });
    const gated = await makeCourse({ visibility: "PREMIUM" });
    const live = await makeCourse();

    const entries = await publicCourses.loadLearnSitemapEntries();
    const paths = entries.map((e) => e.path);

    expect(paths).toContain(`/learn/forex/${live.slug}`);
    expect(paths).not.toContain(`/learn/forex/${draft.slug}`);
    expect(paths).not.toContain(`/learn/forex/${gated.slug}`);
  });
});

// ─── Recommendations (ADR-055, ContentRelation reuse) ────────

describe("recommendations", () => {
  it("returns explicit picks in the editor's order, then fills from the same track", async () => {
    const source = await makeCourse({ track: "forex", title: "Source Course" });
    const pickA = await makeCourse({ track: "forex", title: "Pick A" });
    const pickB = await makeCourse({ track: "forex", title: "Pick B" });
    await makeCourse({ track: "forex", title: "Filler One" });

    await courses.saveCourse(editor, {
      courseId: source.courseId,
      meta: {},
      translation: { locale: "en", title: "Source Course" },
      // Deliberately B before A: `findMany` does not preserve `in` order, so a
      // curated list whose order is ignored is not a curated list.
      recommendations: [pickB.courseId, pickA.courseId],
    });

    const result = await publicCourses.resolveRecommendations("en", source.courseId, "forex", 3);
    expect(result.slice(0, 2).map((c) => c.id)).toEqual([pickB.courseId, pickA.courseId]);
    expect(result).toHaveLength(3);
    expect(result.map((c) => c.id)).not.toContain(source.courseId);
  });

  it("never recommends the course itself", async () => {
    const source = await makeCourse({ track: "crypto", title: "Only Crypto Course" });
    const result = await publicCourses.resolveRecommendations("en", source.courseId, "crypto", 3);
    expect(result.map((c) => c.id)).not.toContain(source.courseId);
  });

  it("never recommends an unpublished course, even an explicitly picked one", async () => {
    const source = await makeCourse({ track: "forex", title: "Rec Source" });
    const hidden = await makeCourse({ track: "forex", title: "Hidden Pick", publish: false });

    await courses.saveCourse(editor, {
      courseId: source.courseId,
      meta: {},
      translation: { locale: "en", title: "Rec Source" },
      recommendations: [hidden.courseId],
    });

    const result = await publicCourses.resolveRecommendations("en", source.courseId, "forex", 3);
    expect(result.map((c) => c.id)).not.toContain(hidden.courseId);
  });

  it("leaves recommendations untouched when a save omits them", async () => {
    const source = await makeCourse({ track: "forex", title: "Keeps Recs" });
    const pick = await makeCourse({ track: "forex", title: "Kept Pick" });

    await courses.saveCourse(editor, {
      courseId: source.courseId,
      meta: {},
      translation: { locale: "en", title: "Keeps Recs" },
      recommendations: [pick.courseId],
    });
    // A save from the Details tab must not wipe what the Recommendations tab set.
    await courses.saveCourse(editor, {
      courseId: source.courseId,
      meta: { difficulty: "ADVANCED" },
      translation: { locale: "en", title: "Keeps Recs" },
    });

    expect(await courses.getCourseRecommendations(source.courseId)).toEqual([pick.courseId]);
  });

  it("clears them when a save passes an empty list", async () => {
    const source = await makeCourse({ track: "forex", title: "Clears Recs" });
    const pick = await makeCourse({ track: "forex", title: "Dropped Pick" });

    await courses.saveCourse(editor, {
      courseId: source.courseId,
      meta: {},
      translation: { locale: "en", title: "Clears Recs" },
      recommendations: [pick.courseId],
    });
    await courses.saveCourse(editor, {
      courseId: source.courseId,
      meta: {},
      translation: { locale: "en", title: "Clears Recs" },
      recommendations: [],
    });

    expect(await courses.getCourseRecommendations(source.courseId)).toEqual([]);
  });
});

// ─── Media references (ADR-055 #6, ADR-035 guard) ────────────

describe("media placement protects assets", () => {
  async function makeAsset(name: string): Promise<string> {
    const asset = await db.mediaAsset.create({
      data: {
        key: `${Math.random().toString(16).slice(2).padEnd(24, "0").slice(0, 24)}.png`,
        url: `/uploads/${name}.png`,
        fileName: `${name}.png`,
        mimeType: "image/png",
        size: 128,
        purpose: "content",
      },
    });
    return asset.id;
  }

  it("refuses to delete an asset attached to a lesson", async () => {
    const { lessonId } = await makeCourse();
    const assetId = await makeAsset("attachment");

    await lessons.setLessonAttachments(editor, lessonId, [{ assetId, label: "Worksheet" }]);

    await expect(media.deleteMedia(editor.id, assetId)).rejects.toThrow(media.MediaAssetInUseError);
  });

  it("refuses to delete a course cover", async () => {
    const { courseId } = await makeCourse();
    const assetId = await makeAsset("cover");

    await courses.saveCourse(editor, {
      courseId,
      meta: { coverAssetId: assetId },
      translation: { locale: "en", title: "Covered Course" },
    });

    await expect(media.deleteMedia(editor.id, assetId)).rejects.toThrow(media.MediaAssetInUseError);
  });

  it("releases the asset once the placement is removed", async () => {
    const { lessonId } = await makeCourse();
    const assetId = await makeAsset("released");

    await lessons.setLessonAttachments(editor, lessonId, [{ assetId }]);
    await lessons.setLessonAttachments(editor, lessonId, []);

    await expect(media.deleteMedia(editor.id, assetId)).resolves.not.toThrow();
  });

  it("keeps the hero reference when attachments are saved separately", async () => {
    const { lessonId } = await makeCourse();
    const hero = await makeAsset("hero");
    const attachment = await makeAsset("doc");

    await lessons.saveLesson(editor, {
      lessonId,
      meta: { heroAssetId: hero },
      translation: { locale: "en", title: "With hero", content: "<p>x</p>" },
      attachments: [],
    });
    // syncReferences replaces the whole set for a source, so a naive
    // attachments-only sync would silently drop the hero's reference and let
    // deleteMedia remove an image that is still on the page.
    await lessons.setLessonAttachments(editor, lessonId, [{ assetId: attachment }]);

    await expect(media.deleteMedia(editor.id, hero)).rejects.toThrow(media.MediaAssetInUseError);
  });

  it("carries attachments and their references into a duplicated lesson", async () => {
    const { lessonId } = await makeCourse();
    const assetId = await makeAsset("dup");
    await lessons.setLessonAttachments(editor, lessonId, [{ assetId }]);

    const copyId = await lessons.duplicateLesson(editor, lessonId);
    const copy = await db.lesson.findUniqueOrThrow({
      where: { id: copyId },
      include: { attachments: true },
    });

    expect(copy.status).toBe(ContentStatus.DRAFT);
    expect(copy.attachments.map((a) => a.assetId)).toEqual([assetId]);

    // The copy is an independent usage from the moment it exists, so deleting
    // the ORIGINAL's placement must not free the asset.
    await lessons.setLessonAttachments(editor, lessonId, []);
    await expect(media.deleteMedia(editor.id, assetId)).rejects.toThrow(media.MediaAssetInUseError);
  });
});

// ─── Lesson detail shape ─────────────────────────────────────

describe("lesson detail", () => {
  it("links previous and next across section boundaries", async () => {
    const { courseId, sectionId, slug } = await makeCourse({ title: "Nav Course" });
    const secondSection = await sections.createSection(editor, courseId, "Second");
    await db.courseSection.update({ where: { id: secondSection }, data: { isPublished: true } });

    const middle = await lessons.createLesson(editor, { sectionId, title: "Middle Lesson" });
    const last = await lessons.createLesson(editor, {
      sectionId: secondSection,
      title: "Last Lesson",
    });
    for (const id of [middle, last]) {
      await lessons.saveLesson(editor, {
        lessonId: id,
        meta: {},
        translation: { locale: "en", title: `T ${id}`, content: "<p>x</p>" },
        attachments: [],
      });
      await db.lesson.update({
        where: { id },
        data: { status: ContentStatus.PUBLISHED, publishedAt: new Date() },
      });
    }

    const middleSlug = (
      await db.lessonTranslation.findFirstOrThrow({
        where: { lessonId: middle, locale: "en" },
        select: { slug: true },
      })
    ).slug;

    const view = await publicCourses.loadLessonBySlug("en", slug, middleSlug);
    expect(view).not.toBeNull();
    // A learner at the end of a section continues into the next one rather
    // than hitting a dead end.
    expect(view!.next).not.toBeNull();
    expect(view!.previous).not.toBeNull();
  });

  it("returns null for a lesson requested under the wrong course", async () => {
    const a = await makeCourse();
    const b = await makeCourse();
    const lessonSlug = (
      await db.lessonTranslation.findFirstOrThrow({
        where: { lessonId: a.lessonId, locale: "en" },
        select: { slug: true },
      })
    ).slug;

    expect(await publicCourses.loadLessonBySlug("en", b.slug, lessonSlug)).toBeNull();
  });
});

// ─── Translation freshness ───────────────────────────────────

describe("the OUTDATED sweep", () => {
  async function withSpanish(courseId: string, title: string): Promise<void> {
    await courses.saveCourse(editor, {
      courseId,
      meta: {},
      translation: { locale: "es", title },
    });
    await db.courseTranslation.updateMany({
      where: { courseId, locale: "es" },
      data: { translationStatus: "TRANSLATED" },
    });
  }

  it("flips siblings OUTDATED when the source title changes", async () => {
    const { courseId } = await makeCourse({ title: "Freshness Source" });
    await withSpanish(courseId, "Fuente");

    await courses.saveCourse(editor, {
      courseId,
      meta: {},
      translation: { locale: "en", title: "Freshness Source Revised" },
    });

    const es = await db.courseTranslation.findFirstOrThrow({
      where: { courseId, locale: "es" },
      select: { translationStatus: true },
    });
    expect(es.translationStatus).toBe("OUTDATED");
  });

  it("leaves siblings alone when only an SEO field changed", async () => {
    const { courseId } = await makeCourse({ title: "Seo Only Source" });
    await withSpanish(courseId, "Solo SEO");

    // CourseTranslation has no sourceHash column, so freshness is decided by
    // comparing against the row being overwritten. Without that comparison
    // every save would mark siblings stale and the queue would cry wolf.
    await courses.saveCourse(editor, {
      courseId,
      meta: {},
      translation: {
        locale: "en",
        title: "Seo Only Source",
        seoDescription: "A new meta description.",
      },
    });

    const es = await db.courseTranslation.findFirstOrThrow({
      where: { courseId, locale: "es" },
      select: { translationStatus: true },
    });
    expect(es.translationStatus).toBe("TRANSLATED");
  });

  it("does not flip siblings when a NON-source locale is saved", async () => {
    const { courseId } = await makeCourse({ title: "Non Source Save" });
    await withSpanish(courseId, "No fuente");

    await courses.saveCourse(editor, {
      courseId,
      meta: {},
      translation: { locale: "es", title: "No fuente revisada" },
    });

    const es = await db.courseTranslation.findFirstOrThrow({
      where: { courseId, locale: "es" },
      select: { translationStatus: true },
    });
    expect(es.translationStatus).toBe("TRANSLATED");
  });
});

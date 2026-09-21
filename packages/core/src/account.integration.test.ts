// ADR-123 against a real MariaDB: read tracking, the profile page's read, and
// the avatar.
//
// Testcontainers for the reason `progress.integration.test.ts` gives: the
// properties under test — one row per (learner, article) under a repeated and
// a concurrent beacon, cascade on delete, the public rule applied in the
// `where` — are database behaviours a mocked client would pass while
// production drifted.
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { ContentStatus, LessonProgressStatus } from "@repo/db";
import type * as AccountModule from "./account.ts";
import type * as MediaModule from "./media.ts";
import { startCmsTestDb, stopCmsTestDb, type CmsTestContext } from "./test-utils/cms-container.ts";

let ctx: CmsTestContext;
let account: typeof AccountModule;
let media: typeof MediaModule;

let alice: string;
let bob: string;
let categoryId: string;

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
const SAFE_SVG = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>');

async function makeLearner(id: string): Promise<string> {
  await ctx.db.user.create({
    data: { id, email: `${id}@learner.example`, name: id, userType: "LEARNER", status: "ACTIVE" },
  });
  return id;
}

async function makeArticle(
  slug: string,
  overrides: { status?: ContentStatus; isActive?: boolean } = {},
): Promise<string> {
  const article = await ctx.db.article.create({
    data: {
      kind: "NEWS",
      status: overrides.status ?? ContentStatus.PUBLISHED,
      isActive: overrides.isActive ?? true,
      publishedAt: new Date(),
      categoryId,
      translations: { create: { locale: "en", title: `Title ${slug}`, slug } },
    },
  });
  return article.id;
}

function memoryDriver(): MediaModule.StorageDriver {
  const store = new Map<string, Uint8Array>();
  return {
    async put(key, bytes) {
      store.set(key, bytes);
      return `/uploads/${key}`;
    },
    async get(key) {
      return store.get(key) ?? null;
    },
    async delete(key) {
      store.delete(key);
    },
  };
}

beforeAll(async () => {
  ctx = await startCmsTestDb();
  account = await import("./account.ts");
  media = await import("./media.ts");
  alice = await makeLearner("alice");
  bob = await makeLearner("bob");
  const category = await ctx.db.articleCategory.create({
    data: { translations: { create: { locale: "en", name: "Markets", slug: "markets" } } },
  });
  categoryId = category.id;
}, 180_000);

afterEach(() => {
  media.setStorageDriverForTests(null);
});

afterAll(async () => {
  await stopCmsTestDb(ctx);
});

describe("recordArticleRead", () => {
  it("writes one row per learner and article, and moves readAt on a re-read", async () => {
    const articleId = await makeArticle("repeat");
    await account.recordArticleRead(alice, articleId);
    const first = await ctx.db.articleRead.findUniqueOrThrow({
      where: { userId_articleId: { userId: alice, articleId } },
    });

    await new Promise((resolve) => setTimeout(resolve, 15));
    await account.recordArticleRead(alice, articleId);

    const rows = await ctx.db.articleRead.findMany({ where: { userId: alice, articleId } });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.readAt.getTime()).toBeGreaterThan(first.readAt.getTime());
  });

  it("survives concurrent beacons for the same pair", async () => {
    const articleId = await makeArticle("concurrent");
    await Promise.all(Array.from({ length: 6 }, () => account.recordArticleRead(alice, articleId)));
    expect(await ctx.db.articleRead.count({ where: { userId: alice, articleId } })).toBe(1);
  });

  it("keeps two learners' reads apart", async () => {
    const articleId = await makeArticle("two-readers");
    await account.recordArticleRead(alice, articleId);
    await account.recordArticleRead(bob, articleId);
    expect(await ctx.db.articleRead.count({ where: { articleId } })).toBe(2);
  });

  it("refuses a draft, an inactive article and an unknown id with the same error", async () => {
    const draft = await makeArticle("draft", { status: ContentStatus.DRAFT });
    const hidden = await makeArticle("hidden", { isActive: false });
    for (const id of [draft, hidden, "no-such-article"]) {
      await expect(account.recordArticleRead(alice, id)).rejects.toBeInstanceOf(
        account.ArticleNotReadableError,
      );
    }
    expect(await ctx.db.articleRead.count({ where: { articleId: { in: [draft, hidden] } } })).toBe(
      0,
    );
  });

  it("cascades when the article is deleted", async () => {
    const articleId = await makeArticle("deleted");
    await account.recordArticleRead(alice, articleId);
    await ctx.db.article.delete({ where: { id: articleId } });
    expect(await ctx.db.articleRead.count({ where: { articleId } })).toBe(0);
  });
});

describe("loadLearnerProfile / loadLearnerActivity", () => {
  it("returns null for an unknown user", async () => {
    expect(await account.loadLearnerProfile("nobody")).toBeNull();
  });

  it("reports reads newest first and drops an article that stopped being public", async () => {
    const reader = await makeLearner("reader");
    const older = await makeArticle("older-read");
    const newer = await makeArticle("newer-read");
    const unpublished = await makeArticle("later-hidden");
    await account.recordArticleRead(reader, older);
    await new Promise((resolve) => setTimeout(resolve, 15));
    await account.recordArticleRead(reader, unpublished);
    await new Promise((resolve) => setTimeout(resolve, 15));
    await account.recordArticleRead(reader, newer);
    await ctx.db.article.update({ where: { id: unpublished }, data: { isActive: false } });

    const view = await account.loadLearnerActivity(reader, "en");
    expect(view.reads.map((read) => read.href)).toEqual(["/news/newer-read", "/news/older-read"]);
    // The row itself is kept — history is hidden, never deleted.
    expect(await ctx.db.articleRead.count({ where: { userId: reader } })).toBe(3);
  });

  it("builds the resume link from the first incomplete reachable lesson", async () => {
    const learner = await makeLearner("resumer");
    const course = await ctx.db.course.create({
      data: {
        track: "forex",
        status: ContentStatus.PUBLISHED,
        lessonCount: 3,
        translations: { create: { locale: "en", title: "Basics", slug: "basics" } },
      },
    });
    const section = await ctx.db.courseSection.create({
      data: { courseId: course.id, isPublished: true, sortOrder: 0 },
    });
    const lesson = (
      slug: string,
      sortOrder: number,
      status: ContentStatus = ContentStatus.PUBLISHED,
    ) =>
      ctx.db.lesson.create({
        data: {
          sectionId: section.id,
          sortOrder,
          status,
          translations: { create: { locale: "en", title: `Lesson ${slug}`, slug } },
        },
      });
    const one = await lesson("one", 0);
    await lesson("draft", 1, ContentStatus.DRAFT);
    const two = await lesson("two", 2);
    await lesson("three", 3);

    await ctx.db.courseEnrollment.create({
      data: { userId: learner, courseId: course.id, lessonsCompleted: 1, lastLessonId: one.id },
    });
    await ctx.db.lessonProgress.create({
      data: {
        userId: learner,
        lessonId: one.id,
        courseId: course.id,
        status: LessonProgressStatus.COMPLETED,
        completedAt: new Date(),
      },
    });

    const view = await account.loadLearnerActivity(learner, "en");
    expect(view.courses).toHaveLength(1);
    const [entry] = view.courses;
    expect(entry!.href).toBe("/learn/forex/basics");
    expect(entry!.percent).toBe(33);
    // The draft between them is skipped; "two" is the next thing not done.
    expect(entry!.resume).toEqual({ title: "Lesson two", href: "/learn/forex/basics/two" });
    expect(two.id).toBeTruthy();
  });

  it("reports each course's final assessment and whole-history totals (changes-42)", async () => {
    const learner = await makeLearner("assessed");
    const quiz = await ctx.db.quiz.create({
      data: {
        track: "forex",
        status: ContentStatus.PUBLISHED,
        translations: { create: { locale: "en", title: "Final exam", slug: "final-exam" } },
        questions: { create: { correctAnswer: 0 } },
      },
    });
    const course = await ctx.db.course.create({
      data: {
        track: "forex",
        status: ContentStatus.PUBLISHED,
        lessonCount: 0,
        finalQuizId: quiz.id,
        translations: { create: { locale: "en", title: "Assessed", slug: "assessed" } },
      },
    });
    // ADR-139 #2: an inactive course leaves the record exactly as it leaves
    // the site — from the list AND from the totals.
    const hidden = await ctx.db.course.create({
      data: {
        track: "forex",
        status: ContentStatus.PUBLISHED,
        isActive: false,
        translations: { create: { locale: "en", title: "Hidden", slug: "hidden-course" } },
      },
    });
    for (const courseId of [course.id, hidden.id]) {
      await ctx.db.courseEnrollment.create({ data: { userId: learner, courseId } });
    }
    const attempt = (attemptNumber: number, percentage: number, passed: boolean) =>
      ctx.db.quizAttempt.create({
        data: {
          quizId: quiz.id,
          userId: learner,
          attemptNumber,
          percentage,
          passed,
          answers: {},
          grades: {},
          completedAt: new Date(),
        },
      });
    await attempt(1, 40, false);
    await attempt(2, 90, true);

    const view = await account.loadLearnerActivity(learner, "en");
    expect(view.courses.map((entry) => entry.href)).toEqual(["/learn/forex/assessed"]);
    expect(view.courses[0]!.finalQuiz).toEqual({
      title: "Final exam",
      href: "/learn/forex/quizzes/final-exam",
      passed: true,
      bestPercentage: 90,
      attempts: 2,
    });
    expect(view.summary).toEqual({
      coursesStarted: 1,
      coursesCompleted: 0,
      lessonsCompleted: 0,
      quizzesPassed: 1,
      quizAttempts: 2,
      articlesRead: 0,
    });
  });

  it("reports hasPassword and twoFactorEnabled from the account rows", async () => {
    const learner = await makeLearner("secured");
    await ctx.db.account.create({
      data: {
        id: "acc-secured",
        accountId: learner,
        providerId: "credential",
        issuer: "credential",
        userId: learner,
        password: "hash",
      },
    });
    await ctx.db.user.update({ where: { id: learner }, data: { twoFactorEnabled: true } });
    const profile = await account.loadLearnerProfile(learner);
    expect(profile?.hasPassword).toBe(true);
    expect(profile?.twoFactorEnabled).toBe(true);
    expect((await account.loadLearnerProfile(bob))?.hasPassword).toBe(false);
  });
});

describe("setOwnAvatar", () => {
  it("stores the image, points the user at it and audits the change", async () => {
    media.setStorageDriverForTests(memoryDriver());
    const { url } = await account.setOwnAvatar(alice, { bytes: PNG, fileName: "me.png" });

    const user = await ctx.db.user.findUniqueOrThrow({ where: { id: alice } });
    expect(user.image).toBe(url);
    const asset = await ctx.db.mediaAsset.findFirstOrThrow({ where: { url } });
    expect(asset.purpose).toBe("avatar");
    expect(asset.folder).toBe("/general/avatars");
    expect(
      await ctx.db.auditLog.count({ where: { userId: alice, action: "users.avatarUpdate" } }),
    ).toBe(1);
  });

  it("refuses an SVG before anything is stored", async () => {
    media.setStorageDriverForTests(memoryDriver());
    const before = await ctx.db.mediaAsset.count();
    await expect(
      account.setOwnAvatar(alice, { bytes: SAFE_SVG, fileName: "me.svg" }),
    ).rejects.toBeInstanceOf(media.UploadRejectedError);
    expect(await ctx.db.mediaAsset.count()).toBe(before);
  });

  it("refuses bytes that are not an image, and a file over the avatar budget", async () => {
    media.setStorageDriverForTests(memoryDriver());
    await expect(
      account.setOwnAvatar(alice, { bytes: new TextEncoder().encode("hello"), fileName: "x.png" }),
    ).rejects.toBeInstanceOf(media.UploadRejectedError);

    const huge = new Uint8Array(2 * 1024 * 1024 + 1);
    huge.set(PNG);
    await expect(
      account.setOwnAvatar(alice, { bytes: huge, fileName: "huge.png" }),
    ).rejects.toBeInstanceOf(media.UploadRejectedError);
  });

  it("removeOwnAvatar clears the picture and audits once", async () => {
    await account.removeOwnAvatar(alice);
    await account.removeOwnAvatar(alice); // already clear: no second audit row
    const user = await ctx.db.user.findUniqueOrThrow({ where: { id: alice } });
    expect(user.image).toBeNull();
    expect(
      await ctx.db.auditLog.count({ where: { userId: alice, action: "users.avatarRemove" } }),
    ).toBe(1);
  });
});

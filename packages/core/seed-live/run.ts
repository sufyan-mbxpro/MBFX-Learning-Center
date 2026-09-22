// `pnpm seed:live` (ADR-144 §1) — bring a fresh install up complete in one
// step, AFTER `pnpm db:deploy` and `pnpm db:seed`.
//
//   1. Theme, brand assets, settings and flags from `defaults.json`
//      (once per database — an admin's later edits survive a re-run).
//   2. Provider keys from SEED_* env vars, sealed through the same services
//      the admin screens use. Absent ⇒ skipped, never an error. A provider
//      that already holds a key is left alone.
//   3. Content: three courses per school (the regular seed's demo course plus
//      two here), two quizzes, six video topics — each skipped when its slug
//      already exists.
//   4. Pictures for every seeded row that has none: demo courses, lessons,
//      quizzes, video topics, glossary topics and articles.
//
// Everything is written through @repo/core, so the sanitizer, the lesson
// recount, redirects, ContentReference rows and the audit log all run
// exactly as they do for an admin's save. Every image enters storage through
// `storeMedia()` — magic-byte sniffed and size-capped (security.md #9).
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ContentStatus, DbNull, db } from "@repo/db";
import { loadSubject, type Subject } from "@repo/rbac";
import { setFeatureFlagEnabled, updateSettings, type UpdateSettingsEntry } from "@repo/settings";
import {
  courseInputSchema,
  lessonInputSchema,
  quizInputSchema,
  videoTopicInputSchema,
  type CourseInput,
  type MediaCategory,
  type SettingKey,
} from "@repo/contracts";
import {
  activateTheme,
  createCourse,
  createLesson,
  createQuiz,
  createSection,
  createVideoTopic,
  getQuizAdmin,
  getVideoTopicAdmin,
  loadCourseAdminDetail,
  loadGlossaryTopicAdminDetail,
  loadLessonAdminDetail,
  loadMarketProvider,
  recordAudit,
  saveAiFeature,
  saveAiSetup,
  saveCourse,
  saveEmailTransport,
  saveGlossaryTopic,
  saveLesson,
  saveMarketProvider,
  saveQuiz,
  saveSection,
  saveTheme,
  saveVideoTopic,
  setBrandAsset,
  setCourseStatus,
  setLessonStatus,
  setQuizStatus,
  storeMedia,
  transitionContentStatus,
  updateArticleMeta,
  updateMediaMeta,
  type SaveThemeInput,
} from "../src/index.ts";
import {
  ARTICLE_IMAGES,
  COURSES,
  DEMO_COURSE_COVERS,
  DEMO_LESSON_HEROES,
  DEMO_QUIZ_COVERS,
  DEMO_VIDEO_COVERS,
  GLOSSARY_TOPIC_COVERS,
  IMAGE_ALT,
  QUIZZES,
  VIDEO_TOPICS,
  type ImageName,
} from "./content.ts";
import { isFileRef, type DefaultsFile } from "./defaults-file.ts";
import { DEFAULTS_FILE, MEDIA_DIR, loadRootEnv, pinUploadsRoot } from "./env.ts";
import { buildCheatSheetPdf } from "./pdf.ts";

const DEFAULTS_MARKER = "seed.live.defaults";

const stats = { created: 0, skipped: 0, filled: 0, uploaded: 0 };

function env(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

// ─── Actor ───────────────────────────────────────────────────

/** The seeded super admin — every write is audited under a real staff subject. */
async function resolveActor(): Promise<Subject> {
  const email = env("SEED_ADMIN_EMAIL");
  const user =
    (email
      ? await db.user.findFirst({ where: { email, deletedAt: null }, select: { id: true } })
      : null) ??
    (await db.user.findFirst({
      where: {
        deletedAt: null,
        status: "ACTIVE",
        userType: "STAFF",
        roles: { some: { role: { key: "super_admin" } } },
      },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    }));
  if (!user) {
    throw new Error("No active super admin found — run `pnpm db:seed` first.");
  }
  const subject = await loadSubject(user.id);
  if (!subject) throw new Error("The super admin could not be loaded as a subject.");
  return subject;
}

async function defaultLocale(): Promise<string> {
  return (
    (await db.locale.findFirst({ where: { isDefault: true }, select: { code: true } }))?.code ??
    "en"
  );
}

// ─── Media ───────────────────────────────────────────────────

const uploadCache = new Map<string, { id: string; url: string }>();

/**
 * One library row per (picture, category), found again by its stored file
 * name on a re-run so a second run uploads nothing twice.
 */
async function image(
  actor: Subject,
  name: ImageName,
  category: MediaCategory,
): Promise<{ id: string; url: string }> {
  const stem = `seed-live-${category}-${name}`;
  const cached = uploadCache.get(stem);
  if (cached) return cached;

  const existing = await db.mediaAsset.findFirst({
    where: { fileName: { startsWith: `${stem}.` }, deletedAt: null },
    select: { id: true, url: true },
  });
  if (existing) {
    uploadCache.set(stem, existing);
    return existing;
  }

  const bytes = new Uint8Array(readFileSync(join(MEDIA_DIR, `${name}.webp`)));
  const stored = await storeMedia(actor.id, {
    bytes,
    fileName: `${stem}.webp`,
    purpose: category === "news" ? "article" : "content",
    category,
    allowedKinds: ["IMAGE"],
  });
  await updateMediaMeta(actor.id, stored.id, {
    title: IMAGE_ALT[name].slice(0, 200),
    altText: IMAGE_ALT[name],
  });
  stats.uploaded += 1;
  const ref = { id: stored.id, url: stored.url };
  uploadCache.set(stem, ref);
  return ref;
}

async function uploadFile(
  actor: Subject,
  relative: string,
  purpose: "brand" | "setting",
): Promise<{ id: string; url: string }> {
  const bytes = new Uint8Array(readFileSync(join(MEDIA_DIR, relative)));
  const stored = await storeMedia(actor.id, {
    bytes,
    fileName: relative.split("/").pop() ?? relative,
    purpose,
    category: "brand",
  });
  stats.uploaded += 1;
  return { id: stored.id, url: stored.url };
}

// ─── Status ──────────────────────────────────────────────────

/** The seven-state machine's shortest walk from DRAFT to PUBLISHED. */
const PUBLISH_PATH: ContentStatus[] = [
  ContentStatus.IN_REVIEW,
  ContentStatus.SEO_REVIEW,
  ContentStatus.APPROVED,
  ContentStatus.PUBLISHED,
];

async function publish(
  current: ContentStatus,
  step: (to: ContentStatus) => Promise<void>,
): Promise<void> {
  if (current !== ContentStatus.DRAFT) return;
  for (const to of PUBLISH_PATH) await step(to);
}

// ─── 1. Defaults ─────────────────────────────────────────────

function readDefaults(): DefaultsFile | null {
  if (!existsSync(DEFAULTS_FILE)) return null;
  return JSON.parse(readFileSync(DEFAULTS_FILE, "utf8")) as DefaultsFile;
}

async function resolveFileRefs(actor: Subject, value: unknown): Promise<unknown> {
  if (isFileRef(value)) return (await uploadFile(actor, value.$file, "setting")).url;
  if (Array.isArray(value)) return Promise.all(value.map((v) => resolveFileRefs(actor, v)));
  if (value && typeof value === "object") {
    const entries = await Promise.all(
      Object.entries(value).map(async ([k, v]) => [k, await resolveFileRefs(actor, v)] as const),
    );
    return Object.fromEntries(entries);
  }
  return value;
}

async function applyDefaults(actor: Subject, defaults: DefaultsFile, aiReady: boolean) {
  if (await db.auditLog.findFirst({ where: { action: DEFAULTS_MARKER }, select: { id: true } })) {
    console.log("  defaults: already applied to this database — skipped");
    return;
  }

  if (defaults.theme) {
    const t = defaults.theme;
    const result = await saveTheme(actor.id, {
      themeKey: t.key,
      brandColors: t.brandColors,
      lightSurface: t.lightSurface,
      darkSurface: t.darkSurface,
      darkBrandOverrides: t.darkBrandOverrides ?? undefined,
      layoutTokens: t.layoutTokens,
    } as SaveThemeInput);
    if (result.saved) {
      await db.theme.update({
        where: { key: t.key },
        data: { name: t.name, description: t.description, defaultMode: t.defaultMode as never },
      });
      // Both surfaces start from the exported palette (ADR-148).
      await activateTheme(actor.id, t.key, "web");
      await activateTheme(actor.id, t.key, "admin");
      console.log(`  theme: ${t.key} saved and applied to both surfaces`);
    } else {
      console.warn(`  ! theme ${t.key} failed validation — kept the seeded theme`);
    }
  }

  for (const asset of defaults.brandAssets) {
    if (!asset.file) continue; // a static /brand/* path the regular seed already writes
    const stored = await uploadFile(actor, asset.file, "brand");
    await setBrandAsset(actor.id, {
      key: asset.key as never,
      mediaAssetId: stored.id,
      ...(asset.altText ? { altText: asset.altText } : {}),
    });
    console.log(`  brand asset: ${asset.key}`);
  }

  const entries: UpdateSettingsEntry[] = [];
  const known = new Set((await db.setting.findMany({ select: { key: true } })).map((s) => s.key));
  for (const [key, raw] of Object.entries(defaults.settings)) {
    if (!known.has(key)) continue;
    // AI switches only once a provider can actually answer: `ai.enabled` over
    // the seeded ECHO driver would put placeholder text in every editor.
    if (key.startsWith("ai.") && !aiReady) continue;
    entries.push({ key: key as SettingKey, value: await resolveFileRefs(actor, raw) });
  }
  if (entries.length > 0) await updateSettings(entries, actor.id);
  console.log(
    `  settings: ${entries.length} applied${aiReady ? "" : " (ai.* held back — no AI key)"}`,
  );

  for (const [key, enabled] of Object.entries(defaults.flags)) {
    if (await db.featureFlag.findUnique({ where: { key }, select: { id: true } })) {
      await setFeatureFlagEnabled(key, enabled);
    }
  }

  if (aiReady && defaults.ai) {
    for (const feature of defaults.ai.features) {
      await saveAiFeature(actor, {
        key: feature.key,
        isEnabled: feature.isEnabled,
        providerId: null,
        modelId: null,
        maxOutputTokens: feature.maxOutputTokens,
        extraInstructions: feature.extraInstructions,
      } as never);
    }
  }

  await recordAudit({ userId: actor.id, action: DEFAULTS_MARKER, entityType: "seed" });
}

// ─── 2. Keys ─────────────────────────────────────────────────

async function applyMarketKey(actor: Subject, defaults: DefaultsFile | null): Promise<void> {
  const apiKey = env("SEED_MARKET_PROVIDER_API_KEY");
  if (!apiKey) {
    console.log("  market provider: SEED_MARKET_PROVIDER_API_KEY not set — skipped");
    return;
  }
  const current = await loadMarketProvider();
  if (current.hasApiKey) {
    console.log("  market provider: already holds a key — left alone");
    return;
  }
  const driver = (env("SEED_MARKET_PROVIDER_KIND") ??
    defaults?.market?.driver ??
    "ALPHAVANTAGE") as "ALPHAVANTAGE" | "MANUAL";
  await saveMarketProvider(actor, {
    driver,
    baseUrl: defaults?.market?.baseUrl ?? null,
    apiKey,
    refreshSeconds: defaults?.market?.refreshSeconds ?? 86_400,
    staleSeconds: defaults?.market?.staleSeconds ?? 86_400,
    isEnabled: true,
  });
  console.log(`  market provider: ${driver} configured, key sealed`);
}

/** Returns whether an AI provider is usable after this step. */
async function applyAiKey(actor: Subject, defaults: DefaultsFile | null): Promise<boolean> {
  const configured = await db.aiProvider.findFirst({
    where: { isDefault: true, isEnabled: true, apiKeyCipher: { not: null } },
    select: { kind: true },
  });
  const apiKey = env("SEED_AI_PROVIDER_API_KEY");
  if (configured) {
    console.log(`  AI provider: ${configured.kind} already configured — left alone`);
    return true;
  }
  if (!apiKey) {
    console.log("  AI provider: SEED_AI_PROVIDER_API_KEY not set — skipped (AI stays off)");
    return false;
  }

  const kind = env("SEED_AI_PROVIDER_KIND") ?? defaults?.ai?.kind;
  if (!kind) throw new Error("SEED_AI_PROVIDER_KIND is required (no exported AI provider).");
  const sameKind = defaults?.ai?.kind === kind;
  const settingTier = (role: string) =>
    typeof defaults?.settings[`ai.model.${role}`] === "string"
      ? (defaults.settings[`ai.model.${role}`] as string)
      : undefined;
  const tiers = {
    light: env("SEED_AI_MODEL_LIGHT") ?? (sameKind ? settingTier("light") : undefined),
    standard: env("SEED_AI_MODEL_STANDARD") ?? (sameKind ? settingTier("standard") : undefined),
    heavy: env("SEED_AI_MODEL_HEAVY") ?? (sameKind ? settingTier("heavy") : undefined),
  };
  if (!tiers.light || !tiers.standard || !tiers.heavy) {
    throw new Error("SEED_AI_MODEL_LIGHT / _STANDARD / _HEAVY are required for this provider.");
  }

  const models = sameKind ? [...(defaults?.ai?.models ?? [])] : [];
  for (const modelId of new Set(Object.values(tiers) as string[])) {
    if (!models.some((m) => m.modelId === modelId)) {
      models.push({
        modelId,
        label: modelId.replace(/^models\//, ""),
        inputPricePerMTok: 0,
        outputPricePerMTok: 0,
        cachedInputPricePerMTok: null,
        maxOutputTokens: 4096,
        supportsVision: false,
      });
    }
  }

  const existing = await db.aiProvider.findFirst({
    where: { kind: kind as never },
    select: { id: true },
  });
  await saveAiSetup(actor, {
    providerId: existing?.id ?? null,
    kind: kind as never,
    baseUrl: env("SEED_AI_PROVIDER_BASE_URL") ?? (sameKind ? defaults?.ai?.baseUrl : null) ?? "",
    apiKey,
    models,
    tiers: tiers as { light: string; standard: string; heavy: string },
  });
  console.log(`  AI provider: ${kind} configured with ${models.length} model(s), key sealed`);
  return true;
}

async function applySmtp(actor: Subject): Promise<void> {
  const host = env("SEED_SMTP_HOST");
  if (!host) {
    console.log("  SMTP: SEED_SMTP_HOST not set — skipped (mail goes to the log driver)");
    return;
  }
  const current = await db.emailTransport.findFirst({ select: { host: true } });
  if (current?.host) {
    console.log("  SMTP: transport already configured — left alone");
  } else {
    const port = Number(env("SEED_SMTP_PORT") ?? "587");
    const security = (env("SEED_SMTP_SECURITY") ?? (port === 465 ? "TLS" : "STARTTLS")) as
      "NONE" | "STARTTLS" | "TLS";
    await saveEmailTransport(actor, {
      driver: "SMTP",
      host,
      port,
      security,
      username: env("SEED_SMTP_USER"),
      password: env("SEED_SMTP_PASSWORD"),
    });
    console.log(`  SMTP: ${host}:${port} (${security}) configured, password sealed`);
  }
  const from = env("SEED_SMTP_FROM");
  if (from) {
    await updateSettings([{ key: "email.fromEmail" as SettingKey, value: from }], actor.id);
    console.log(`  SMTP: sender address set to ${from}`);
  }
}

// ─── 3. Content ──────────────────────────────────────────────

async function seedCourses(actor: Subject, locale: string): Promise<void> {
  const created: { id: string; input: CourseInput; track: string }[] = [];

  for (const spec of COURSES) {
    const found = await db.courseTranslation.findUnique({
      where: { locale_slug: { locale, slug: spec.slug } },
      select: { courseId: true },
    });
    if (found) {
      stats.skipped += 1;
      continue;
    }

    const courseId = await createCourse(actor, { track: spec.track, title: spec.title });
    const cover = await image(actor, spec.image, "learn");
    const input = courseInputSchema.parse({
      courseId,
      meta: {
        difficulty: spec.difficulty,
        estimatedHours: spec.hours,
        coverAssetId: cover.id,
        visibility: "PUBLIC",
        isFeatured: spec.featured,
      },
      translation: {
        locale,
        title: spec.title,
        slug: spec.slug,
        summary: spec.summary,
        description: spec.description,
        seoTitle: spec.seoTitle,
        seoDescription: spec.seoDescription,
        seoFocusKeyword: spec.keyword,
      },
    });
    await saveCourse(actor, input);

    const allLessons = spec.sections.flatMap((s) => s.lessons);
    const lastLesson = allLessons[allLessons.length - 1];
    for (const section of spec.sections) {
      const sectionId = await createSection(actor, courseId, section.title);
      await saveSection(actor, {
        sectionId,
        isPublished: true,
        translation: { locale, title: section.title, description: section.description },
      });

      for (const lesson of section.lessons) {
        const lessonId = await createLesson(actor, { sectionId, title: lesson.title });
        const hero = await image(actor, lesson.image, "learn");
        const attachments: { assetId: string; label: string }[] = [];
        if (lesson === lastLesson) {
          const pdf = await storeMedia(actor.id, {
            bytes: buildCheatSheetPdf(spec.cheatSheet.title, spec.cheatSheet.lines),
            fileName: `${spec.slug}-cheat-sheet.pdf`,
            purpose: "content",
            category: "learn",
            allowedKinds: ["DOCUMENT"],
          });
          await updateMediaMeta(actor.id, pdf.id, { title: spec.cheatSheet.title });
          stats.uploaded += 1;
          attachments.push({ assetId: pdf.id, label: spec.cheatSheet.label });
        }
        await saveLesson(
          actor,
          lessonInputSchema.parse({
            lessonId,
            meta: {
              difficulty: spec.difficulty,
              estimatedMinutes: lesson.minutes,
              videoUrl: lesson.videoUrl ?? null,
              externalUrl: lesson.externalUrl ?? null,
              heroAssetId: hero.id,
              completionRule: "MANUAL",
              isRequired: true,
              visibility: "PUBLIC",
            },
            translation: {
              locale,
              title: lesson.title,
              slug: lesson.slug,
              summary: lesson.summary,
              content: lesson.content,
              learningObjectives: lesson.objectives,
              seoTitle: lesson.seoTitle,
              seoDescription: lesson.seoDescription,
              seoFocusKeyword: lesson.keyword,
            },
            attachments,
          }),
        );
        await publish(ContentStatus.DRAFT, (to) => setLessonStatus(actor, lessonId, to));
      }
    }

    await publish(ContentStatus.DRAFT, (to) => setCourseStatus(actor, courseId, to));
    created.push({ id: courseId, input, track: spec.track });
    stats.created += 1;
    console.log(`  course: ${spec.track}/${spec.slug}`);
  }

  // Recommendations — the other published courses in the same school. A
  // second save, because the first course of a school cannot recommend one
  // that does not exist yet.
  for (const course of created) {
    const siblings = await db.course.findMany({
      where: {
        track: course.track,
        id: { not: course.id },
        status: ContentStatus.PUBLISHED,
        deletedAt: null,
      },
      orderBy: { sortOrder: "asc" },
      select: { id: true },
      take: 3,
    });
    if (siblings.length === 0) continue;
    await saveCourse(actor, { ...course.input, recommendations: siblings.map((s) => s.id) });
  }
}

async function seedQuizzes(actor: Subject, locale: string): Promise<void> {
  for (const spec of QUIZZES) {
    const found = await db.quizTranslation.findUnique({
      where: { locale_slug: { locale, slug: spec.slug } },
      select: { quizId: true },
    });
    if (found) {
      stats.skipped += 1;
      continue;
    }
    const quizId = await createQuiz(actor, { title: spec.title, track: spec.track });
    const cover = await image(actor, spec.image, "learn");
    await saveQuiz(
      actor,
      quizInputSchema.parse({
        quizId,
        meta: {
          passingScore: 70,
          maxAttempts: null,
          showAnswersAfter: "AFTER_SUBMIT",
          isStandalone: true,
          track: spec.track,
          category: spec.category,
          coverAssetId: cover.id,
          visibility: "PUBLIC",
          isFeatured: true,
        },
        translation: { locale, title: spec.title, slug: spec.slug, description: spec.description },
        questions: spec.questions.map((q, index) => ({
          type: q.type,
          sortOrder: index,
          points: 1,
          prompt: q.prompt,
          options: q.options,
          explanations: q.explanations,
          correctAnswer: q.correctAnswer,
        })),
      }),
    );
    await publish(ContentStatus.DRAFT, (to) => setQuizStatus(actor, quizId, to));
    stats.created += 1;
    console.log(`  quiz: ${spec.track}/${spec.slug} (${spec.questions.length} questions)`);
  }
}

function videoBody(summary: string, watchFor: string[]): string {
  return (
    `<h2>About these videos</h2><p>${summary}</p>` +
    `<h2>What to watch for</h2><ul>${watchFor.map((w) => `<li>${w}</li>`).join("")}</ul>` +
    "<p>These recordings are made and hosted by their creators on YouTube. " +
    "They are general education, not advice about any trade.</p>"
  );
}

async function seedVideoTopics(actor: Subject, locale: string): Promise<void> {
  for (const spec of VIDEO_TOPICS) {
    const found = await db.videoTopicTranslation.findUnique({
      where: { locale_slug: { locale, slug: spec.slug } },
      select: { topicId: true },
    });
    if (found) {
      stats.skipped += 1;
      continue;
    }
    const category = spec.category
      ? await db.videoCategoryTranslation.findFirst({
          where: { locale, slug: spec.category },
          select: { categoryId: true },
        })
      : null;
    const categoryId = category?.categoryId ?? null;
    const topicId = await createVideoTopic(actor, {
      title: spec.title,
      track: spec.track,
      categoryId,
    });
    const cover = await image(actor, spec.image, "learn");
    await saveVideoTopic(
      actor,
      videoTopicInputSchema.parse({
        topicId,
        meta: {
          track: spec.track,
          categoryId,
          coverAssetId: cover.id,
          visibility: "PUBLIC",
          isFeatured: spec.featured,
        },
        translation: {
          locale,
          title: spec.title,
          slug: spec.slug,
          summary: spec.summary,
          content: videoBody(spec.summary, spec.watchFor),
          seoTitle: spec.seoTitle,
          seoDescription: spec.seoDescription,
          seoFocusKeyword: spec.keyword,
        },
        videos: spec.videos.map((v, index) => ({
          externalUrl: v.url,
          title: v.title,
          sortOrder: index,
        })),
        links: spec.links.map((l) =>
          l.path ? { label: l.label, path: l.path } : { label: l.label, url: l.url },
        ),
      }),
    );
    await publish(ContentStatus.DRAFT, (to) =>
      transitionContentStatus(actor, "videos", topicId, to),
    );
    stats.created += 1;
    console.log(`  video topic: ${spec.track}/${spec.slug} (${spec.videos.length} video(s))`);
  }
}

// ─── 4. Pictures where missing ───────────────────────────────

async function fillCourseCovers(actor: Subject, locale: string): Promise<void> {
  for (const [slug, picture] of Object.entries(DEMO_COURSE_COVERS)) {
    const t = await db.courseTranslation.findUnique({
      where: { locale_slug: { locale, slug } },
      select: { courseId: true },
    });
    const detail = t ? await loadCourseAdminDetail(t.courseId) : null;
    const tr = detail?.translations.find((x) => x.locale === locale);
    if (!detail || !tr || detail.coverAssetId) continue;
    const cover = await image(actor, picture, "learn");
    await saveCourse(actor, {
      courseId: detail.id,
      meta: { coverAssetId: cover.id },
      translation: {
        locale,
        title: tr.title,
        slug: tr.slug,
        summary: tr.summary,
        description: tr.description,
        seoTitle: tr.seoTitle,
        seoDescription: tr.seoDescription,
        seoFocusKeyword: tr.seoFocusKeyword,
      },
    });
    stats.filled += 1;
  }
}

async function fillLessonHeroes(actor: Subject, locale: string): Promise<void> {
  for (const [slug, picture] of Object.entries(DEMO_LESSON_HEROES)) {
    const t = await db.lessonTranslation.findUnique({
      where: { locale_slug: { locale, slug } },
      select: { lessonId: true },
    });
    const detail = t ? await loadLessonAdminDetail(t.lessonId) : null;
    const tr = detail?.translations.find((x) => x.locale === locale);
    if (!detail || !tr || detail.heroAssetId) continue;
    const hero = await image(actor, picture, "learn");
    await saveLesson(actor, {
      lessonId: detail.id,
      meta: { heroAssetId: hero.id },
      translation: {
        locale,
        title: tr.title,
        slug: tr.slug,
        summary: tr.summary,
        content: tr.content,
        learningObjectives: tr.learningObjectives,
        seoTitle: tr.seoTitle,
        seoDescription: tr.seoDescription,
        seoFocusKeyword: tr.seoFocusKeyword,
      },
      attachments: detail.attachments.map((a) => ({ assetId: a.assetId, label: a.label })),
    });
    stats.filled += 1;
  }
}

async function fillQuizCovers(actor: Subject, locale: string): Promise<void> {
  for (const [slug, picture] of Object.entries(DEMO_QUIZ_COVERS)) {
    const t = await db.quizTranslation.findUnique({
      where: { locale_slug: { locale, slug } },
      select: { quizId: true },
    });
    const quiz = t ? await getQuizAdmin(t.quizId, locale) : null;
    const tr = quiz?.translations.find((x) => x.locale === locale);
    if (!quiz || !tr || quiz.coverAssetId) continue;
    const cover = await image(actor, picture, "learn");
    await saveQuiz(
      actor,
      quizInputSchema.parse({
        quizId: quiz.id,
        meta: { coverAssetId: cover.id },
        translation: { locale, title: tr.title, slug: tr.slug, description: tr.description },
        questions: quiz.questions.map((q) => ({
          id: q.id,
          type: q.type,
          sortOrder: q.sortOrder,
          points: q.points,
          prompt: q.prompt,
          options: q.options,
          explanations: q.explanations,
          correctAnswer: q.correctAnswer,
        })),
      }),
    );
    stats.filled += 1;
  }
}

async function fillVideoCovers(actor: Subject, locale: string): Promise<void> {
  for (const [slug, picture] of Object.entries(DEMO_VIDEO_COVERS)) {
    const t = await db.videoTopicTranslation.findUnique({
      where: { locale_slug: { locale, slug } },
      select: { topicId: true },
    });
    const topic = t ? await getVideoTopicAdmin(t.topicId) : null;
    const tr = topic?.translations.find((x) => x.locale === locale);
    if (!topic || !tr || topic.coverAssetId) continue;
    const cover = await image(actor, picture, "learn");
    await saveVideoTopic(actor, {
      topicId: topic.id,
      meta: { coverAssetId: cover.id },
      translation: {
        locale,
        title: tr.title,
        slug: tr.slug,
        summary: tr.summary,
        content: tr.content,
        seoTitle: tr.seoTitle,
        seoDescription: tr.seoDescription,
        seoFocusKeyword: tr.seoFocusKeyword,
      },
      videos: topic.videos.map((v) => ({
        id: v.id,
        assetId: v.assetId,
        externalUrl: v.externalUrl,
        posterAssetId: v.posterAssetId,
        title: v.title,
        sortOrder: v.sortOrder,
      })),
      links: topic.links.map((l) => ({ label: l.label, path: l.path, url: l.url })),
    });
    stats.filled += 1;
  }
}

async function fillGlossaryTopicCovers(actor: Subject, locale: string): Promise<void> {
  for (const [slug, picture] of Object.entries(GLOSSARY_TOPIC_COVERS)) {
    const t = await db.glossaryTopicTranslation.findFirst({
      where: { locale, slug },
      select: { topicId: true },
    });
    const topic = t ? await loadGlossaryTopicAdminDetail(t.topicId) : null;
    const tr = topic?.translations.find((x) => x.locale === locale);
    if (!topic || !tr || topic.coverAssetId) continue;
    const cover = await image(actor, picture, "learn");
    await saveGlossaryTopic(actor, {
      topicId: topic.id,
      locale,
      name: tr.name,
      slug: tr.slug,
      description: tr.description,
      seoTitle: tr.seoTitle,
      seoDescription: tr.seoDescription,
      seoKeywords: tr.seoKeywords,
      coverAssetId: cover.id,
    });
    stats.filled += 1;
  }
}

async function fillArticleImages(actor: Subject, locale: string): Promise<void> {
  const articles = await db.article.findMany({
    where: {
      deletedAt: null,
      OR: [{ coverImageAssetId: null }, { headerImageAssetId: null }],
    },
    select: {
      id: true,
      coverImageAssetId: true,
      headerImageAssetId: true,
      translations: { where: { locale }, select: { slug: true } },
    },
  });
  articles.sort((a, b) =>
    (a.translations[0]?.slug ?? a.id).localeCompare(b.translations[0]?.slug ?? b.id),
  );
  for (const [index, article] of articles.entries()) {
    const picture = ARTICLE_IMAGES[index % ARTICLE_IMAGES.length] as ImageName;
    const pic = await image(actor, picture, "news");
    await updateArticleMeta(actor, article.id, {
      ...(article.coverImageAssetId ? {} : { coverImageUrl: pic.url, coverImageAssetId: pic.id }),
      ...(article.headerImageAssetId
        ? {}
        : { headerImageUrl: pic.url, headerImageAssetId: pic.id }),
    });
    stats.filled += 1;
  }
}

// ─── Report ──────────────────────────────────────────────────

async function report(): Promise<void> {
  const [courses, quizzes, videos, terms, topics, toolsNoFaq] = await Promise.all([
    db.course.groupBy({
      by: ["track"],
      where: { status: ContentStatus.PUBLISHED, deletedAt: null },
      _count: true,
    }),
    db.quiz.count({ where: { status: ContentStatus.PUBLISHED, deletedAt: null } }),
    db.videoTopic.count({ where: { status: ContentStatus.PUBLISHED, deletedAt: null } }),
    db.glossaryTerm.count({ where: { status: ContentStatus.PUBLISHED, deletedAt: null } }),
    db.glossaryTopic.count(),
    db.toolTranslation.count({ where: { faq: { equals: DbNull } } }),
  ]);
  console.log(
    `\nPublished: ${courses.map((c) => `${c._count} ${c.track} course(s)`).join(", ")}, ` +
      `${quizzes} quiz(zes), ${videos} video topic(s), ${terms} glossary term(s) in ${topics} topic(s).`,
  );
  if (toolsNoFaq > 0) {
    console.warn(
      `  ! ${toolsNoFaq} tool translation(s) have no FAQ — run \`pnpm db:seed\`, which fills them.`,
    );
  }
  console.log(
    `This run: ${stats.created} created, ${stats.skipped} already present, ` +
      `${stats.filled} picture(s) filled in, ${stats.uploaded} file(s) uploaded.`,
  );
}

async function main(): Promise<void> {
  loadRootEnv();
  const uploadsRoot = pinUploadsRoot();
  console.log(`Live seed — uploads → ${uploadsRoot}`);

  const actor = await resolveActor();
  const locale = await defaultLocale();
  const defaults = readDefaults();

  console.log("Keys:");
  await applyMarketKey(actor, defaults);
  const aiReady = await applyAiKey(actor, defaults);
  await applySmtp(actor);

  console.log("Defaults:");
  if (defaults) await applyDefaults(actor, defaults, aiReady);
  else console.log("  defaults.json not found — run `pnpm seed:export-defaults` on a dev install");

  console.log("Content:");
  await seedCourses(actor, locale);
  await seedQuizzes(actor, locale);
  await seedVideoTopics(actor, locale);

  console.log("Pictures where missing:");
  await fillCourseCovers(actor, locale);
  await fillLessonHeroes(actor, locale);
  await fillQuizCovers(actor, locale);
  await fillVideoCovers(actor, locale);
  await fillGlossaryTopicCovers(actor, locale);
  await fillArticleImages(actor, locale);

  await report();
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());

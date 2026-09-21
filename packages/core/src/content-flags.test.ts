// ADR-139 #2: `isActive` is part of every learning type's ONE public rule, so
// an inactive row leaves every page, the search, the sitemap and the counts at
// once. These are the predicates those readers compose; a rule that loses the
// clause would pass every type check and quietly publish hidden content.
import { describe, expect, it } from "vitest";
import { contentFlagsData } from "./content.ts";
import { publicGlossaryTermWhere } from "./public-content.ts";
import { publicCourseWhere, publicLessonWhere } from "./public-courses.ts";
import { publicQuizWhere } from "./quiz-links.ts";
import { publicVideoWhere } from "./videos.ts";

describe("the public rules carry isActive (ADR-139 #2)", () => {
  it.each([
    ["course", publicCourseWhere],
    ["lesson", publicLessonWhere],
    ["quiz", publicQuizWhere],
    ["video topic", publicVideoWhere],
    ["glossary term", publicGlossaryTermWhere],
  ])("%s", (_name, rule) => {
    expect(rule(new Date())).toMatchObject({ isActive: true, deletedAt: null });
  });
});

describe("contentFlagsData", () => {
  it("writes only the flags a save sent", () => {
    expect(contentFlagsData({})).toEqual({});
    expect(contentFlagsData({ isActive: false })).toEqual({ isActive: false });
    expect(contentFlagsData({ isFeatured: true, isPremium: false })).toEqual({
      isFeatured: true,
      isPremium: false,
    });
  });
});

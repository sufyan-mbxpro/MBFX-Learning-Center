// "Is AI on?", answered once, on the server (ADR-097 #6 / plan §13).
//
// **No client component asks this.** Each admin page's server component
// resolves it and passes the answer down as props, so the affordance arrives as
// the PRESENCE of a prop and a disabled platform ships no AI client code into
// the editor bundle at all.
//
// **Disabled, capped or unconfigured means ABSENT, not disabled.** A greyed
// "Generate" with no explanation is a support ticket; no button plus one banner
// on the AI screen is an answer. `ai-degradation.test.ts` fails on a `disabled`
// AI control, the way `newsletter-signup.test.ts` fails on a disabled newsletter
// control — because a greyed button is the failure mode this rule exists to
// prevent, and it is the one a future PR will reintroduce by accident.
import type { AiFeatureKey } from "@repo/contracts";

import { getBudgetState, type BudgetState } from "./budget.ts";
import { loadAiLimits, loadEnabledFeatureKeys } from "./config.ts";

export interface AiAvailability {
  /** The global switch AND the budget together — one boolean per question. */
  enabled: boolean;
  /** Per feature, already folded with `enabled` and the cap. */
  features: Partial<Record<AiFeatureKey, boolean>>;
  budget: BudgetState;
  capBehavior: "DISABLE" | "NOTIFY_ONLY";
}

/**
 * One server-side read, shaped so a caller cannot get it half right.
 *
 * `features[key]` is already false when the platform is off or the budget is
 * spent, so a screen that checks only the feature is still correct. That is
 * deliberate: the failure this shape prevents is a page that renders an
 * affordance because its feature is on, on a platform whose cap was reached an
 * hour ago.
 */
export async function getAiAvailability(): Promise<AiAvailability> {
  const limits = await loadAiLimits();
  const budget = await getBudgetState({
    budgetUsd: limits.monthlyBudgetUsd,
    warnPercent: limits.budgetWarnPercent,
  });

  const stopped = budget.status === "capped" && limits.capBehavior === "DISABLE";
  const enabled = limits.enabled && !stopped;

  const features: Partial<Record<AiFeatureKey, boolean>> = {};
  if (enabled) {
    for (const key of await loadEnabledFeatureKeys()) features[key] = true;
  }

  return { enabled, features, budget, capBehavior: limits.capBehavior };
}

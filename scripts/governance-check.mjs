#!/usr/bin/env node
// Governance enforcement (plan.md Part B, "Enforcement, not vibes"):
//   1. A branch that changes packages/* must also append to docs/logs/DEVLOG.md.
//   2. An existing ADR is never modified — it is superseded by a new file.
//      (Exception: the Status / "Superseded by" header lines of the old ADR,
//      which the superseding flow must touch.)
//
// Pure rule functions are exported for the vitest suite; the CLI wrapper
// gathers real git state. Base ref resolution: $GOVERNANCE_BASE, else
// merge-base with origin/main, else the empty tree (first commit).

import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const DEVLOG_PATH = "docs/logs/DEVLOG.md";
const ADR_DIR = "docs/memory/decisions/";
const EMPTY_TREE = "4b825dc642cb6eb9a060e54bf8d69288fbee4904";

/** Rule 1. `changed` is a list of repo-relative paths. */
export function checkDevlogRule(changed) {
  const touchesPackages = changed.some((f) => f.startsWith("packages/"));
  const touchesDevlog = changed.includes(DEVLOG_PATH);
  if (touchesPackages && !touchesDevlog) {
    return {
      ok: false,
      message:
        `packages/* changed without a DEVLOG entry. Append to ${DEVLOG_PATH} ` +
        "(date, module, what shipped, decisions, test status) in the same branch.",
    };
  }
  return { ok: true };
}

/**
 * Rule 2. `entries` is [{ status, path }] from `git diff --name-status`
 * (status "A" added, "M" modified, ...). `readDiff(path)` returns the
 * unified diff body for one file so header-only edits can be allowed.
 */
export function checkAdrRule(entries, readDiff) {
  const failures = [];
  for (const { status, path } of entries) {
    if (!path.startsWith(ADR_DIR) || !/ADR-\d+.*\.md$/.test(path)) continue;
    if (status.startsWith("A")) continue; // new ADRs are the point
    if (status.startsWith("M")) {
      const changedLines = readDiff(path)
        .split("\n")
        .filter((l) => /^[+-][^+-]/.test(l));
      const headerOnly = changedLines.every((l) =>
        /^[+-]\s*(\*\*Status:\*\*|\*\*Superseded by:\*\*|$)/.test(l),
      );
      if (!headerOnly) {
        failures.push(path);
      }
    } else {
      // Deleted/renamed ADRs also violate append-only history.
      failures.push(path);
    }
  }
  if (failures.length > 0) {
    return {
      ok: false,
      message:
        "ADR history is append-only. Modified/removed: " +
        failures.join(", ") +
        ". Write a new superseding ADR instead; only the old ADR's Status/" +
        "'Superseded by' header lines may change.",
    };
  }
  return { ok: true };
}

function git(...args) {
  // stderr piped to keep expected-failure probes (no HEAD yet) quiet
  return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

function resolveBase() {
  if (process.env.GOVERNANCE_BASE) return process.env.GOVERNANCE_BASE;
  try {
    return git("merge-base", "HEAD", "origin/main").trim();
  } catch {
    try {
      git("rev-parse", "--verify", "HEAD");
      return EMPTY_TREE;
    } catch {
      return null; // no commits at all — nothing to check
    }
  }
}

export function run() {
  const base = resolveBase();
  if (base === null) {
    console.log("governance:check — no commits yet, nothing to compare. OK.");
    return 0;
  }
  const nameStatus = git("diff", "--name-status", base, "HEAD")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [status, ...rest] = line.split("\t");
      return { status, path: rest[rest.length - 1].replace(/\\/g, "/") };
    });

  const changed = nameStatus.map((e) => e.path);
  const results = [
    checkDevlogRule(changed),
    checkAdrRule(nameStatus, (p) => git("diff", "-U0", base, "HEAD", "--", p)),
  ];

  const failures = results.filter((r) => !r.ok);
  for (const f of failures) console.error(`governance:check FAIL — ${f.message}`);
  if (failures.length === 0) console.log("governance:check — OK.");
  return failures.length === 0 ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(run());
}

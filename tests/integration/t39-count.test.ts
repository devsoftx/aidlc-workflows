// covers: function:loadScopeMapping
//
// t39 — scope EXECUTE-count validation. The authoritative source for per-scope
// stage inclusion is scope-grid.json: each scope carries a `stages` map of
// <slug> -> "EXECUTE" | "SKIP" (ScopeDefinition, aidlc-lib.ts). This test imports
// the pure loader the rest of the toolchain uses, loadScopeMapping (aidlc-lib.ts),
// and asserts against the Record<string, ScopeDefinition> it returns.
//
// Mechanism: none (a pure in-process function call, zero subprocess, zero LLM,
// zero tokens). loadScopeMapping reads no project dir, emits no audit rows and
// writes nothing, so there is no CLI shell to keep as a spawn seam.
//
// Counts are exact EXECUTE totals from the grid, initialization included: the
// grid lists every stage, and each scope runs its three initialization stages.
// The compiled grid holds 36 stages in all (3 initialization + 33 runnable).
//
// FIXTURE DISCIPLINE: none. loadScopeMapping reads the shipped data in place;
// nothing is created, copied, or written under tests/fixtures/** or a temp dir.

import { describe, expect, test } from "bun:test";
import {
  loadScopeMapping,
  type ScopeDefinition,
} from "../../dist/claude/.claude/tools/aidlc-lib.ts";

// Load once: loadScopeMapping memoises internally (aidlc-lib.ts), so a single
// call is the canonical entrypoint; every case reuses the parsed object.
const MAPPING: Record<string, ScopeDefinition> = loadScopeMapping();

/** Number of stages set to "EXECUTE" for <scope>. */
function execCount(scope: string): number {
  return Object.values(MAPPING[scope].stages).filter((v) => v === "EXECUTE")
    .length;
}

/** True iff <slug> is "EXECUTE" in <scope>. */
function isExecute(scope: string, slug: string): boolean {
  return MAPPING[scope].stages[slug] === "EXECUTE";
}

describe("t39 scope EXECUTE-count validation — loadScopeMapping (migrated from t39-scope-stage-count-validation.sh, plan 9)", () => {
  // The loader returns a usable map keyed by the eleven canonical scopes, each
  // carrying a `stages` record. Pin that shape once up front so a missing or
  // renamed scope fails here, by name, rather than as a TypeError mid-case.
  test("0a: loadScopeMapping returns the eleven canonical scopes (S3)", () => {
    expect(Object.keys(MAPPING).sort()).toEqual(
      [
        "bugfix",
        "classic",
        "enterprise",
        "express",
        "feature",
        "infra",
        "mvp",
        "poc",
        "refactor",
        "security-patch",
        "workshop",
      ].sort(),
    );
  });

  test("0b: every stage value is EXECUTE or SKIP across all scopes (S2)", () => {
    // execCount only counts "EXECUTE"; this guards the implicit invariant that
    // the other value is exactly "SKIP" (ScopeDefinition's
    // Record<string,"EXECUTE"|"SKIP">), so a stray third value can't silently
    // shrink an EXECUTE count and pass a range check.
    for (const [scope, def] of Object.entries(MAPPING)) {
      for (const [slug, value] of Object.entries(def.stages)) {
        expect(value === "EXECUTE" || value === "SKIP").toBe(true);
        // touch slug/scope so a failure message localises the offender
        if (value !== "EXECUTE" && value !== "SKIP") {
          throw new Error(`${scope}.${slug} = ${value as string}`);
        }
      }
    }
  });

  // 1. Enterprise: every stage EXECUTE.
  test("1: enterprise executes all 36 stages", () => {
    expect(execCount("enterprise")).toBe(36);
  });

  // 2. Feature: every stage EXECUTE except conformance-review.
  test("2: feature executes 35 stages (all but conformance-review)", () => {
    expect(execCount("feature")).toBe(35);
  });

  // 3. MVP: operate skipped.
  test("3: mvp executes exactly 25 stages", () => {
    expect(execCount("mvp")).toBe(25);
  });

  // 4. POC: deploy and operate skipped.
  test("4: poc executes exactly 10 stages", () => {
    expect(execCount("poc")).toBe(10);
  });

  // 5. Bugfix: exactly 11 (init, RE, requirements, code generation, build and
  // test, code and security review, deployment pipeline and execution).
  test("5: bugfix executes exactly 11 stages", () => {
    expect(execCount("bugfix")).toBe(11);
  });

  // 6. Refactor: operate skipped.
  test("6: refactor executes exactly 12 stages", () => {
    expect(execCount("refactor")).toBe(12);
  });

  // 7. Infra: discover skipped.
  test("7: infra executes exactly 18 stages", () => {
    expect(execCount("infra")).toBe(18);
  });

  // 8. Security-patch: includes deployment-pipeline AND deployment-execution.
  // One test() asserts both observables.
  test("8: security-patch executes deployment-pipeline and deployment-execution", () => {
    expect(isExecute("security-patch", "deployment-pipeline")).toBe(true);
    expect(isExecute("security-patch", "deployment-execution")).toBe(true);
  });

  // 9. Classic: deploy and operate skipped.
  test("9: classic executes exactly 21 stages", () => {
    expect(execCount("classic")).toBe(21);
  });

  test("9b: workshop remains a compatible 28-stage scope", () => {
    expect(execCount("workshop")).toBe(28);
  });

  // 10. Express: the fixed lightweight grid.
  test("10: express executes exactly 12 stages", () => {
    expect(execCount("express")).toBe(12);
  });
});

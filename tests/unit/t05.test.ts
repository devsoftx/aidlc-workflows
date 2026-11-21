// covers: function:parseStageFrontmatter
//
// t05 — every shipped stage .md parses to a slug + phase that match its
// filename stem and parent directory.
// Mechanism: none (pure parse of on-disk files; zero LLM, zero tokens,
// zero process spawns).
// Technique: example-based, table-driven over the 36 committed stages.
//
// In-process migration of tests/unit/t05-stage-files.sh (TAP plan 64).
// The .sh spawned `bun -e` TWICE per stage (one for obj.slug, one for
// obj.phase) — 32 stages x 2 = 64 `bun -e` process launches. Each launch
// re-imported aidlc-lib.ts and re-parsed one stage file, then printed a
// single scalar that the shell string-compared against the expected slug
// or phase. This port reads the SAME files with readFileSync and calls
// parseStageFrontmatter() directly in-process, asserting the SAME two
// observable facts per stage. The value of this migration is SPEED: 64
// cold `bun -e` spawns collapse to one process.
//
// MECHANISM SPLIT: all 64 behaviours port in-process. There is no CLI
// shell, argv parsing, or process.exit anywhere in the .sh — it only
// inspects the return value of parseStageFrontmatter — so NO Bun.spawnSync
// env-seam case is retained.
//
// Sources read for this port:
//   dist/claude/.claude/tools/aidlc-lib.ts
//     export function parseStageFrontmatter(raw: string):
//       Record<string, unknown>  — returns the parsed YAML frontmatter
//       object; obj.slug and obj.phase are the two fields asserted here.
//
// Fixture note: this test reads the REAL committed stage tree (read-only),
// exactly as the .sh did via STAGES_DIR. No tempdir fixtures are built —
// the contract under test IS that the shipped files parse correctly, so
// rebuilding them in a tempdir would test a copy, not the artifact.
//
// Parity mapping: the .sh's STAGE_TABLE listed (phase, slug) pairs. This file
// lists the slugs and takes each phase from the compiled stage graph through
// phaseFor(), so a stage that moves between phases needs no edit here. Each
// stage yields the same two assertions the .sh's stage_check() emitted
// ("<phase>/<slug> slug matches filename" and "<phase>/<slug> phase matches
// directory"): 72 expect() calls for 36 stages.

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseStageFrontmatter } from "../../dist/claude/.claude/tools/aidlc-lib.ts";
import { phaseFor } from "../harness/stage-phase.ts";

const STAGES_DIR = join(
  import.meta.dir,
  "..",
  "..",
  "dist", "claude",
  ".claude",
  "aidlc-common",
  "stages",
);

// The stage slugs, in source order. Driving from this explicit list (rather than
// globbing) asserts that each stage's slug equals its FILENAME STEM and that its
// phase (from phaseFor, the compiled graph) equals its PARENT DIRECTORY - a glob
// would only confirm self-consistency, not the filename/directory contract.
const STAGE_SLUGS: ReadonlyArray<string> = [
  // Initialization (3)
  "workspace-scaffold",
  "workspace-detection",
  "state-init",
  // Discover (8)
  "intent-capture",
  "market-research",
  "feasibility",
  "reverse-engineering",
  "scope-definition",
  "team-formation",
  "rough-mockups",
  "approval-handoff",
  // Design (12)
  "practices-discovery",
  "requirements-analysis",
  "user-stories",
  "refined-mockups",
  "domain-design",
  "units-generation",
  "contract-design",
  "delivery-planning",
  "functional-design",
  "nfr-requirements",
  "nfr-design",
  "infrastructure-design",
  // Build (1)
  "code-generation",
  // Test (2)
  "build-and-test",
  "performance-validation",
  // Secure (3)
  "code-review",
  "security-review",
  "conformance-review",
  // Deploy (4)
  "ci-pipeline",
  "deployment-pipeline",
  "environment-provisioning",
  "deployment-execution",
  // Operate (3)
  "observability-setup",
  "incident-response",
  "feedback-optimization",
];

function parseStage(phase: string, slug: string): Record<string, unknown> {
  const file = join(STAGES_DIR, phase, `${slug}.md`);
  return parseStageFrontmatter(readFileSync(file, "utf8")) as Record<
    string,
    unknown
  >;
}

// Guard: pin the table length so a stage added/removed without updating this
// test is caught.
describe("t05 stage table integrity", () => {
  test("table holds exactly 36 stages (72 assertions = 36 x 2)", () => {
    expect(STAGE_SLUGS.length).toBe(36);
  });
});

// =========================================================================
// Per-stage parse (2 assertions per stage = 72 total).
// =========================================================================
describe("each stage .md parses to a slug + phase matching its location", () => {
  for (const slug of STAGE_SLUGS) {
    const phase = phaseFor(slug);

    test(`${phase}/${slug} slug matches filename`, () => {
      const obj = parseStage(phase, slug);
      expect(obj.slug).toBe(slug);
    });

    test(`${phase}/${slug} phase matches directory`, () => {
      const obj = parseStage(phase, slug);
      expect(obj.phase).toBe(phase);
    });
  }
});

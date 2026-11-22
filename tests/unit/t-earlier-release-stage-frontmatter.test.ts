// covers: file:core/aidlc-common/stages/design/requirements-analysis.md
//
// A project set up on 2.8.0 to 2.11.0 refreshes to a newer release with its
// own tool: `bun <dir>/tools/aidlc.ts config --from <runtime>` on a copy, and
// `aidlc config` on a native team clone whose teammate pinned a newer release.
// That tool compiles the stage graph from the newer release's stage files with
// its own parser and validator, and stops (exit 4, "schema validation failed")
// on anything it does not know. Their code is in
// tests/fixtures/stage-frontmatter-2.11.0, made by generate.ts there from
// `git show v2.11.0:...` with comment-only lines left out and characters
// outside printable ASCII written as escapes; the hashes below are that
// output, and the three functions hash the same from v2.8.0 to v2.11.0
// (`generate.ts --hashes <tags>`).
//
// Those tools do not know the seven phases, so they stop on every delivery
// stage's phase. Such a project takes one step before it refreshes: `aidlc
// update` on a native install, or a refresh through 2.11.4 on a copy, whose
// tool takes these stage files as they are (18-install-and-lifecycle.md,
// "Projects on 2.8.0 to 2.11.0"). Here their parser and validator run over
// every stage file this build ships, in both trees, and the phase is all they
// refuse: a stage key or shape they would also stop on still fails here. The
// agent roster check they also make reads the same tree's agents and is not
// what this checks.

import { afterAll, describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { declaration, hash, MARKER, PINNED_FUNCTIONS } from "../fixtures/stage-frontmatter-2.11.0/generate.ts";
import { parseStageFrontmatter, VALID_PHASES, validateStageFrontmatter } from "../fixtures/stage-frontmatter-2.11.0/stage-frontmatter.ts";
import { PHASE_LABELS } from "../../core/tools/aidlc-phases.ts";
import { REPO_ROOT } from "../harness/fixtures.ts";
import { HARNESS_MATRIX } from "../harness/harness-matrix.ts";

// No chat names itself to the tools: this process reads the audit in-process and spawns the engine with the inherited
// environment, and a host chat's identity would point both at the wrong shard. Restored after this file.
const HOST_CHAT_VARS = [
  "CLAUDE_CODE_SESSION_ID", "CLAUDE_PID", "CODEX_THREAD_ID", "KIRO_SESSION_ID",
  "AIDLC_SESSION_OVERRIDE", "AIDLC_SESSION_OVERRIDE_SOURCE",
] as const;
const hostChat = Object.fromEntries(HOST_CHAT_VARS.map((key) => [key, process.env[key]]));
for (const key of HOST_CHAT_VARS) delete process.env[key];
afterAll(() => {
  for (const key of HOST_CHAT_VARS) {
    const value = hostChat[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

const FIXTURE = join(REPO_ROOT, "tests", "fixtures", "stage-frontmatter-2.11.0", "stage-frontmatter.ts");
// sha256 of generate.ts's output from v2.11.0, below its marker line.
const BODY = "3468db30d70c1767fdba19a7c48584b279ad5ebc336a9538a09691f8b63bc54f";
// The same on v2.8.0, 2.8.1, 2.8.2, 2.9.0, 2.10.0 and 2.11.0.
const FUNCTIONS: Record<string, string> = {
  parseStageFrontmatter: "3c756f8dbbb0bdb781ec85d3f2a05cc256224dc65891521807fe0d04d01086a1",
  objectListField: "dea46ea9f17f5a3cb36e651772124fa1661ef494345b85c5ee6c39bd751e6c1c",
  validateStageFrontmatter: "118edde754ba9d4430f6b10f6afdd32fec72cbebe824494130be36a156e561a1",
};
const TREES = ["dist", "dist-release"] as const;

const read = (path: string): string => readFileSync(path, "utf-8").replace(/\r\n/g, "\n");

// The stage files those releases compile: <harness dir>/aidlc-common/stages/<phase>/<slug>.md.
function stageFiles(stagesRoot: string): string[] {
  return readdirSync(stagesRoot, { withFileTypes: true })
    .filter((phase) => phase.isDirectory())
    .flatMap((phase) =>
      readdirSync(join(stagesRoot, phase.name))
        .filter((name) => name.endsWith(".md"))
        .sort()
        .map((name) => join(stagesRoot, phase.name, name))
    );
}

// What those releases' validator says of a phase it does not know.
const unknownPhase = (phase: string): string => `phase must be one of ${VALID_PHASES.join(" | ")}, got "${phase}"`;
const SHIPPED_PHASES: readonly string[] = Object.keys(PHASE_LABELS);

describe("a refresh run by a 2.8.0 to 2.11.0 tool stops on this release's stage files for their phase alone", () => {
  test("the copied parser and validator are those releases' own", () => {
    const fixture = read(FIXTURE);
    const at = fixture.indexOf(`${MARKER}\n`);
    expect(at).toBeGreaterThan(0);
    expect(hash(fixture.slice(at + MARKER.length + 1))).toBe(BODY);
    expect(PINNED_FUNCTIONS.map((name) => [name, hash(declaration(fixture, name))]))
      .toEqual(Object.entries(FUNCTIONS));
  });

  for (const tree of TREES) {
    test.each(HARNESS_MATRIX.map((harness) => [harness.name, harness] as const))(
      `${tree} %s: their parser and validator refuse each stage file for its seven-phase name and nothing else`,
      (name, harness) => {
        const stagesRoot = join(REPO_ROOT, tree, name, harness.manifest.harnessDir, "aidlc-common", "stages");
        expect(existsSync(stagesRoot), stagesRoot).toBe(true);
        const files = stageFiles(stagesRoot);
        expect(files.length).toBeGreaterThan(30);
        let refusedForPhase = 0;
        const unexpected = files.flatMap((file) => {
          const relativePath = file.slice(stagesRoot.length + 1);
          const folder = relativePath.split("/")[0];
          const frontmatter = parseStageFrontmatter(read(file));
          const phase = String((frontmatter as { phase?: unknown }).phase);
          const result = validateStageFrontmatter(frontmatter);
          const errors = result.valid ? [] : result.errors;
          // Initialization keeps its name; every other phase is one of the seven.
          const expected = (VALID_PHASES as readonly string[]).includes(phase) ? [] : [unknownPhase(phase)];
          if (expected.length > 0) refusedForPhase++;
          const shipped = phase === folder && SHIPPED_PHASES.includes(phase);
          return shipped && JSON.stringify(errors) === JSON.stringify(expected)
            ? []
            : [`${relativePath} (phase ${phase}): ${errors.join("; ") || "accepted"}`];
        });
        expect(unexpected).toEqual([]);
        expect(refusedForPhase).toBeGreaterThan(30);
      },
    );
  }
});

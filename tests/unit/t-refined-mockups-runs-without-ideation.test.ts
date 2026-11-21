// covers: stage:design/refined-mockups, subcommand:aidlc-orchestrate:next
//
// Refined Mockups is on the classic and workshop plans, which run no Ideation
// stage, so its condition cannot ask for rough mockups from Ideation: read as
// written on those plans, it let the agent skip the stage for a project with a
// UI. Where a plan makes rough mockups, the stage still reads them.
import { NATIVE_FIXTURE_SETUP_TIMEOUT_MS, NATIVE_STARTUP_TIMEOUT_MS, remainingOperationTimeoutMs } from "../harness/test-budget.ts";
import { afterAll, afterEach, describe, expect, setDefaultTimeout, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { AIDLC_SRC, cleanupTestProject, createOrchestrationTestProject, runOrchestrateNext } from "../harness/fixtures.ts";
import { parseStageFrontmatter } from "../../dist/claude/.claude/tools/aidlc-lib.ts";

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

setDefaultTimeout(NATIVE_FIXTURE_SETUP_TIMEOUT_MS);

const DATA = join(AIDLC_SRC, "tools", "data");
const ORCH = join(AIDLC_SRC, "tools", "aidlc-orchestrate.ts");
const UTIL = join(AIDLC_SRC, "tools", "aidlc-utility.ts");
const SEP = "\u2014";
const graph = JSON.parse(readFileSync(join(DATA, "stage-graph.json"), "utf-8")) as Array<{ slug: string; phase: string }>;
const grid = JSON.parse(readFileSync(join(DATA, "scope-grid.json"), "utf-8")) as Record<string, { stages: Record<string, string> }>;
const runs = (plan: string, slug: string) => grid[plan].stages[slug] === "EXECUTE";

const projects: string[] = [];
afterEach(() => {
  while (projects.length) cleanupTestProject(projects.pop());
});

// New work on `plan` for a project with a UI, every stage before Refined
// Mockups done and Refined Mockups in progress: the step the engine hands the agent.
function atRefinedMockups(plan: string): Record<string, unknown> {
  const proj = createOrchestrationTestProject();
  projects.push(proj);
  const made = spawnSync(process.execPath, [UTIL, "intent-create", "--scope", plan, "--arguments", "a sign-up page for the newsletter", "--project-dir", proj], {
    encoding: "utf-8", timeout: remainingOperationTimeoutMs(NATIVE_STARTUP_TIMEOUT_MS),
  });
  expect(made.status, `${made.stdout}${made.stderr}`).toBe(0);
  const intents = join(proj, "aidlc", "spaces", "default", "intents");
  const statePath = join(intents, readFileSync(join(intents, "active-intent"), "utf-8").trim(), "aidlc-state.md");
  let state = readFileSync(statePath, "utf-8");
  for (const { slug } of graph.slice(0, graph.findIndex((stage) => stage.slug === "refined-mockups"))) {
    state = state.replace(new RegExp(`^- \\[ \\] ${slug} ${SEP} EXECUTE`, "m"), `- [x] ${slug} ${SEP} EXECUTE`);
  }
  state = state
    .replace(new RegExp(`^- \\[.\\] refined-mockups ${SEP}`, "m"), `- [-] refined-mockups ${SEP}`)
    .replace(/^- \*\*Current Stage\*\*: .*$/m, "- **Current Stage**: refined-mockups");
  writeFileSync(statePath, state);
  // A fixture has no chat running its hooks: the presence check would stop the step before it is handed out.
  const result = runOrchestrateNext(ORCH, proj, [], { env: { ...process.env, AIDLC_SKIP_HUMAN_PRESENCE_GUARD: "1" } });
  expect(result.directive?.kind, result.out).toBe("run-stage");
  expect(result.directive?.stage).toBe("refined-mockups");
  return result.directive!;
}

describe("t-refined-mockups-runs-without-ideation", () => {
  test("Refined Mockups stays on the plans that list it, and classic and workshop run none of the stages Ideation held", () => {
    expect(Object.keys(grid).filter((plan) => runs(plan, "refined-mockups")).sort())
      .toEqual(["classic", "enterprise", "feature", "mvp", "workshop"]);
    // Ideation's stages are now Discover's, bar Reverse Engineering, which moved there from Inception.
    const ideation = graph
      .filter((stage) => stage.phase === "discover" && stage.slug !== "reverse-engineering")
      .map((stage) => stage.slug);
    for (const plan of ["classic", "workshop"]) expect(ideation.filter((slug) => runs(plan, slug)), plan).toEqual([]);
  });

  test("on the classic plan, the stage the agent is handed runs for a project with a UI and asks nothing of Ideation", () => {
    const step = atRefinedMockups("classic");
    const file = join(dirname(AIDLC_SRC), String(step.stage_file));
    const condition = String(parseStageFrontmatter(readFileSync(file, "utf-8")).condition);
    expect(condition).not.toMatch(/ideation|rough mockups/i);
    expect(condition).toContain("user-facing UI exists");
    expect(condition).toContain("for APIs, refine interaction diagrams");
  });

  test("on the feature plan it still reads the rough mockups Ideation made", () => {
    const step = atRefinedMockups("feature");
    const read = [
      ...(step.consumes as string[]),
      ...((step.consumes_absent ?? []) as Array<{ path: string }>).map((entry) => entry.path),
    ];
    for (const name of ["wireframes.md", "user-flow.md"]) {
      expect(read.some((path) => path.endsWith(`/discover/rough-mockups/${name}`)), JSON.stringify(read)).toBe(true);
    }
  });
});

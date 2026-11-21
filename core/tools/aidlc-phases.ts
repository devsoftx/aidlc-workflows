// The seven-phase names the engine keys off outside the full phase list in
// aidlc-lib.ts. A leaf module: it imports nothing, so a module split out of
// aidlc-lib.ts can use it without reaching back.

type Phase = "initialization" | "discover" | "design" | "build" | "test" | "secure" | "deploy" | "operate";

// Display label for a phase in the state file and on screen. One source, so
// no caller keeps its own copy of the names.
export const PHASE_LABELS: Readonly<Record<Phase, string>> = {
  initialization: "INITIALIZATION",
  discover: "DISCOVER",
  design: "DESIGN",
  build: "BUILD",
  test: "TEST",
  secure: "SECURE",
  deploy: "DEPLOY",
  operate: "OPERATE",
};

// The unit loop (per-unit stages, unit checkpoints, autonomy gating) belongs to
// stages that run once per unit of work, not to one phase. Those stages sit in
// the design and build phases. Code asks this predicate, never the phase name.
export function isUnitLoopStage(node: { for_each?: string | null } | null | undefined): boolean {
  return node?.for_each === "unit-of-work";
}

// Record folders holding per-unit work: <record>/<phase>/<unit>/<stage>.
export const UNIT_RECORD_PHASES: readonly Phase[] = ["design", "build"];

// The phase folder a stage's artefacts sit in, read from the compiled stage graph
// the shipped build carries, so a test helper names no phase by hand.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { AIDLC_SRC } from "./fixtures.ts";

interface GraphStage {
  slug: string;
  phase: string;
}

// Read on first use: fixtures.ts imports this module, so AIDLC_SRC is not yet
// defined while this module loads.
let graph: GraphStage[] | null = null;

export function phaseFor(slug: string): string {
  graph ??= JSON.parse(
    readFileSync(join(AIDLC_SRC, "tools", "data", "stage-graph.json"), "utf-8"),
  ) as GraphStage[];
  const stage = graph.find((entry) => entry.slug === slug);
  if (!stage) throw new Error(`no stage named ${slug} in the compiled stage graph`);
  return stage.phase;
}

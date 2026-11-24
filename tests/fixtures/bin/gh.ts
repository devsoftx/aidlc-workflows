#!/usr/bin/env bun
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

const args = process.argv.slice(2);
if (
  args[0] === "attestation" &&
  args[1] === "verify" &&
  args[2] === "--help"
) {
  process.stdout.write(
    "--signer-workflow string\n--source-ref string\n--source-digest string\n",
  );
  process.exit(0);
}
if (args[0] !== "attestation" || args[1] !== "verify" || !args[2]) {
  process.exit(2);
}
function valueAfter(flag: string): string | undefined {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

const bundle = valueAfter("--bundle");
const sourceRef = valueAfter("--source-ref");
const sourceDigest = valueAfter("--source-digest");
const repository = valueAfter("--repo");
const signerWorkflow = valueAfter("--signer-workflow");
const hostname = valueAfter("--hostname");
const manifestPath = join(dirname(args[2]), "version.json");
const manifestVersion = existsSync(manifestPath)
  ? (JSON.parse(readFileSync(manifestPath, "utf-8")) as { version?: string }).version
  : undefined;
// The repository the caller must check against: the rule of
// releaseRepositoryFor in core/tools/aidlc-release.ts (a stable release before
// 3.0.0 is upstream's, everything else is this repository's). It is written
// out here so the stub starts without loading the lifecycle modules;
// t-release-repository-rule keeps the two in step.
const upstreamStable = /^[012]\.\d+\.\d+$/.test(manifestVersion ?? "");
const expectedRepository =
  process.env.AIDLC_RELEASE_REPOSITORY?.trim() ||
  (upstreamStable ? "awslabs/aidlc-workflows" : "devsoftx/aidlc-workflows");
const expectedWorkflowName = manifestVersion?.includes("-preview.")
  ? "preview-release.yml"
  : "release.yml";
const expectedWorkflow =
  process.env.AIDLC_RELEASE_WORKFLOW?.trim() ||
  `${expectedRepository}/.github/workflows/${expectedWorkflowName}`;
if (
  !existsSync(args[2]) ||
  !bundle ||
  !existsSync(bundle) ||
  readFileSync(bundle, "utf-8").trim() !== "aidlc-test-release-provenance" ||
  repository !== expectedRepository ||
  signerWorkflow !== expectedWorkflow ||
  hostname !== "github.com" ||
  (
    sourceRef !== undefined &&
    sourceRef !== "refs/heads/main" &&
    !sourceRef.startsWith("refs/tags/v")
  ) ||
  (sourceDigest !== undefined && !/^[a-f0-9]{40}$/.test(sourceDigest))
) {
  process.exit(1);
}

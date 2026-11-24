// covers: hook:aidlc-record-human-turn, hook:aidlc-continue-workflow, subcommand:aidlc-orchestrate:report, subcommand:aidlc-orchestrate:next, cli:aidlc-log(answer), cli:aidlc-bolt(checkpoint)
//
// The engine is text-blind: shard 3 of the gate fuzz's short mode (tests/harness/text-blind-fuzz.ts says what each
// run checks and how a failure today's main still has is named to its row).
import { afterAll, expect, setDefaultTimeout, test } from "bun:test";
import { runTextBlindShard, TEXT_BLIND_SHARDS } from "../harness/text-blind-fuzz.ts";

setDefaultTimeout(20 * 60_000);

// No chat names itself to the tools: a run from inside a host's own chat would lend the fixture projects' hooks that
// chat, and a gate's first write (no chat of its own) would bind to it and miss the record's audit shard. Restored
// after this file's tests.
const HOST_CHAT_VARS = [
  "CLAUDE_CODE_SESSION_ID", "CLAUDE_PID", "CODEX_THREAD_ID", "KIRO_SESSION_ID", "CLAUDE_CODE_ENTRYPOINT", "SANDBOX_RUNTIME",
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

test(`the engine is text-blind: shard 3 of ${TEXT_BLIND_SHARDS} of the seeded runs`, async () => {
  const result = await runTextBlindShard(2);
  console.log(`gate fuzz shard 3: ${result.runs} runs, ${result.lines.length} failures, ${result.fresh.length} with no row${result.lines.length ? `\n${result.lines.join("\n")}` : ""}`);
  // The output names runs and rows, never the person's words.
  const shown = [...result.lines, ...result.fresh].join("\n");
  expect(result.typed.filter((text) => text.trim().length >= 12 && shown.includes(text.trim())).length).toBe(0);
  expect(result.fresh, "a failure no FUZZ_STILL_TO_GO row in tests/harness/persons-words-readers.ts names").toEqual([]);
});

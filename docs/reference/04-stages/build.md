# Build Phase -- Stage Reference (3.1)

## Phase Overview

Build is the third of the seven phases in the AI-DLC lifecycle. It follows
Design and turns the unit designs that Design produces into code. It has one
stage, numbered 3.1: Code Generation.

Code Generation is an ALWAYS stage and a unit-loop stage: it runs once for each
unit of work in the execution plan, so the unit walk sets the order in which the
per-unit stages run. Its plan is reviewed adversarially by the Architecture
Reviewer, and the builder revises on NOT-READY up to the review cap. It is the
only stage in the phase, and it runs as a subagent.

[Build and Test](test.md) (4.1) runs once after all the unit work is finished,
and [Secure](secure.md) follows Test.

## Stage Summary Table

| Stage | Name | Condition | Lead Agent | Support Agents | Mode |
|-------|------|-----------|------------|----------------|------|
| 3.1 | Code Generation | ALWAYS | `aidlc-developer-agent` | -- | subagent |

## Scope Applicability

The compiled grid (`EXECUTE` in `scope-grid.json`) lists the Build stages each
scope plans:

| Scope | Stages that run |
|-------|-----------------|
| bugfix | 3.1 |
| classic | 3.1 |
| enterprise | 3.1 |
| express | 3.1 |
| feature | 3.1 |
| infra | 3.1 |
| mvp | 3.1 |
| poc | 3.1 |
| refactor | 3.1 |
| security-patch | 3.1 |
| workshop | 3.1 |

---

## Unit Walk

A [Bolt](../../guide/glossary.md) is the planned delivery slice recorded in
Delivery Planning: one or more Units with a Definition of Done, confidence
hypothesis, and ownership. Runtime order follows `unit-of-work-dependency.md`
and the recorded iteration choice, not the grouping in `bolt-plan.md`.

New solo workflows that include Unit decomposition and an in-scope
source-producing per-unit stage default to `Construction Checkpoints: enabled`,
`Construction Iteration: unit-major`, and `Construction Execution: serial`.
They complete one Unit's applicable design and source-producing stages before
the next. Preserve an explicit stage-major choice. Design-only and no-Unit
workflows retain their existing stage flow; team-owned work uses `unit_gate`.
Existing workflows without the checkpoint setting keep the legacy first-stage
review; their late stage approvals, like those of work with checkpoints off, come
as one question.

For eligible checkpoint work with skeleton-on, the first DAG Unit is the
smallest working integrated slice. It completes its applicable stages, including
Code Generation, before later Units even with stage-major selected. Its real
end-to-end project check must pass, unless the person says to approve the
skeleton as it is over that check (`verify --over-failed-check`), and a human
must approve it. A legacy first per-unit stage approval is only a stage review;
it does not establish that an integrated skeleton has been built.

All Unit/batch checkpoints reuse the intent's recorded, human-authorized
`Construction Verification Command`. Delivery Planning proposes it from the
project scan. Before presenting the command, write it to
`<record>/verification-command.txt` with the harness's file-write tool
(Write/edit), never a shell `echo` or heredoc. Repo-derived command text must never
be interpolated into a shell line, where substitutions could execute before
approval. Both `log decision` and `log answer` take
`--checkpoint verification-command --command-file verification-command.txt` and
find the session they run in.
Copy the complete canonical command exactly from the `command` field in the
`decision` tool's JSON output into the verification-command question's code span;
never abbreviate it. Choose a delimiter that preserves any command backticks.
The human can also open `<record>/verification-command.txt`. The canonical
command is a nonblank single line of at most 1024 characters. Control characters
and display-spoofing characters (Unicode format characters, including zero-width
and bidi controls, line/paragraph separators, and no-break space U+00A0) are refused.
The human's **Approve** / **Request Changes** reply binds the answer to the
pending command, in the chat that asked or in a new one while it is the newest
question asked. Only **Approve** authorizes the receipt; an unrelated reply,
**Request Changes**, or a reply to another question does not.
Never write `--details "Approve"` unless the human chose it; only then run
`state set-construction-verification-command --command-file verification-command.txt` to write the matching Runtime
State field. A human may defer when no runnable
check exists yet; the first checkpoint then asks (on Kiro IDE and Kiro CLI v3, a
side-by-side batch asks once its plans are approved, before its initial `prepare`).
The current approval receipt,
not the field alone, authorizes execution. Changing it requires a new receipt
and typed setter, never generic `state set` or an automatic choice.

Skeleton-off offers **Continue automatically** / **Review each checkpoint** at
the first per-unit stage; skeleton-on offers it after the real skeleton checkpoint.
Only an emitted offer with no recorded choice prompts automatically. On-demand
requests can change the choice during the per-unit stages. The answer controls ordinary
completion questions; it never grants Plan Approval, verification command
selection, an enabled summary confirmation, or successful verification of a
failed check.

```text
Eligible new source-producing solo Unit workflow:
  Default: unit-major + serial + verified Unit checkpoints
  Skeleton-on: first whole integrated Unit → real check → human approval
  When offered: Continue automatically / Review each checkpoint
  Remaining Units: applicable stages → checks → completion per recorded policy
  Completion-only stage directives: bookkeeping over recorded Unit approvals

Existing, design-only, no-Unit, or team-owned workflow:
  Preserve its recorded path and applicable stage or Unit-gate policy

After the per-unit work:
  Build and Test, the Secure reviews, then CI Pipeline if included, run once
  across the solution
```

**Route checkpoints before bodies.** A `construction_checkpoint` directive
verifies and approves existing Unit work; it does not rerun Code Generation.
When it carries `rereview`, run that review request at once, without asking,
then verify and ask the one approval question. `rereview` names one of three
cases: the Unit's code or documents changed since a finished review; the Unit's
own review has not finished (`unfinished`: no verdict yet, or NOT-READY with a
pass left); or it was never asked for in this run of the Unit's work (`first`).
Only Guard Policy `strict` re-checks a change after a finished review: under
`relaxed` and `off` that change is accepted with one line and the Unit's
approval stands, while an unfinished or never-asked review is still named. The same holds with reviews off: the line comes
from the next checkpoint's `verify` or the stage's own check, or,
for a change made between the approval question and the person's answer, from
their `approve`.
With `command_authorized: false`, ask the verification-command question before
any `verify`, complete the human decision/answer/setter flow, then call `next`.
Show "Verified with `<full command>` (exit 0)" in the approval question;
`verification_command` is the full canonical recorded command, never an abbreviated label.
A `swarm_checkpoint` handles a completed batch before later batch work. After
verification, approval, or rejection, call `next`, never approve the whole stage for one Unit or batch.
Only after `verify` reports `verified: true` and the current checkpoint has
`ready: true`, open the human Unit/skeleton approval question with
`aidlc engine bolt checkpoint --action ask --unit "<unit>" --kind <unit|skeleton>`;
`ask` refuses an unready or unverified checkpoint. For a human batch question,
only after status reports `ready: true`, run
`aidlc engine bolt swarm-checkpoint --action ask --batch <N> --units "<Units>"`.
When the Unit `ask` returns `earlier_reply`, the person already answered in
this chat while the Unit's review ran: do not show the question, and run
`approve` or `reject` as their words chose; when their words answer nothing,
show the question and wait. Otherwise present **Approve** / **Request
Changes** and wait. The human's reply
to this checkpoint question authorizes the action the conductor reads from it, in that chat or a
new one: with no question of its own, a new chat's reply is kept for the
checkpoint question another chat asked, while it is the newest question asked
and still open. An unrelated reply, the agent's own words, or a reply to a
different question does not. These commands find their own session; never pass `--user-input`
the human did not choose. Consent is one-shot and bound to the
current checkpoint fingerprint, verification proof ID, and authorized command
digest (batch questions bind the fingerprint and per-Unit `Command SHA-256` set).
Re-running `verify` or swarm `finalize` withdraws every open checkpoint question
and captured checkpoint response for this intent, in any session. Re-verify,
confirm `verified: true` (batch: `ready: true` after source landing), and ask again;
an older response cannot approve the new evidence. Automatic approval
(`human_required: false`) needs no `ask` and no `--user-input`; human rejection
always needs this verified question-and-answer flow.

A stage with `construction_policy.completion_only: true` and
`human_completion_required: false` skips body, questions, reviewer, and learnings
prompt, then reports `awaiting-approval` and `approved` without invented user
input. Other completion gates follow `human_completion_required`; the legacy
path without policy retains its existing human-gate procedure.

Version-4 checkpoint proofs retain the command's `command_sha256` and full
canonical command in `command_label`, plus exit status, full stdout/stderr byte
counts and SHA-256 digests, and the last 2 KiB of each stream in `stdout_tail` and
`stderr_tail`. These tails also appear in checkpoint CLI JSON. They are decoded
as UTF-8 after dropping a leading partial multibyte sequence, with control
characters other than newline and tab replaced by U+FFFD; full output is not
retained. Project check commands must not print secrets: tails are not
secret-redacted. Use the tails to explain a failure; any further diagnostics use
the same authorized project check, not a newly chosen command. Legacy version-1
through version-3 proofs require re-verification with
`aidlc engine bolt checkpoint --action verify --unit "<unit>" --kind <unit|skeleton>`
before the Unit can be approved. `GATE_APPROVED` binds `Verification Command SHA-256`
to the proof's digest.
The verifier records a tool-owned `CHECKPOINT_VERIFICATION_RECORDED` receipt
alongside the proof file, and approval requires that receipt; a hand-written
proof file cannot verify a Unit. On a checkout with no proof file at all (a
fresh clone, another machine), that receipt stands in for the proof of a Unit
already approved whose evidence is unchanged, so nothing runs again.

While `plan_approval` is on, Code Generation's Plan Approval remains a human
stop before generation for every Unit. Grouped Plan Approval may present the exact live swarm Unit set together,
but still records individual receipts. Pre-generation summary confirmation is
required only when `directive.ceremony.summary_confirmation === "on"`. See
[Construction commands](../../guide/12-cli-commands.md#construction-order-and-execution)
for the checkpoint and approval commands.

**Iteration and execution are separate.** Unit-major is serial. To choose swarm
explicitly for eligible checkpoint work, select stage-major and then
`Construction Execution: swarm`; guided and automatic completion are both
supported. An autonomy answer does not change execution or iteration order.
Already approved inline Units are not rebuilt by a later swarm. Legacy workflows
without the execution setting retain their existing autonomy-based swarm route.

**Team-owned gates.** With `Unit Ownership: team`, the `per-stage` rhythm gates
each settled `(stage, Unit)` before that Unit advances; `unit-end` gates once
after its final applicable per-unit stage. These remain separate from the solo
checkpoint policy. The engine refreshes `Unit Progress`, and each gate report
names its Unit so decisions and receipt floors remain scoped to that work.

Team-mode claims use `claim/<intent-id8>/<unit>` refs with compare-and-swap
updates. A successful claim writes a gitignored checkout stamp; that checkout
routes only the stamped Unit and carries the claim generation on lifecycle,
review, gate, and fork evidence. Unscoped main emits a terminal fan-out notice
while claims are live. `aidlc-unit.ts release <unit>` writes a tombstone instead
of deleting the ref, invalidating stale attempts while preserving history. A
team's clone of the work (every stage or gate row of the plan's own, the ones that
name no Unit, in another clone's shard, `planMadeElsewhere`) is offered the Units open to take without the participant
marker, which still opts a clone into the picker by hand
(`aidlc-unit.ts participate`); facilitator main omits it.
Scoped routing and receipt writes are offline-first: the claim-time stamp is
authoritative. Registry liveness is rechecked only at claim-sensitive
boundaries such as fork/release; an unavailable remote warns and proceeds from
the stamp, while an online stale or released attempt is refused.

A completed team is asked once whether to commit and publish
(`aidlc unit publish <unit> --commit`). An unscoped checkout reads the teams'
claim refs from the remote on each `next` and offers a published Unit for
review, then pins the exact claim-ref OID, validates its artifacts/receipts/gates/reviews and
Plan Approval without materializing a worktree, records one human merge gate,
and lands the candidate through `aidlc unit land`. Git content lands before the
Unit row is folded; main-owned state/runtime markers are retained, the team's
new audit shard transports its attempt-keyed receipts, and `UNIT_MERGED` marks
the row. Source conflicts abort before state mutation. After the final merged
row, Build and Test, the Secure reviews and CI Pipeline route once on main.

**Per-unit batch waves (optional, stage-major only).** On a recorded
stage-major path, the engine MAY emit `directive.wave` for one of the four
inline design stages (2.9–2.12). The wave comes from one healed DAG snapshot;
the conductor does not read `runtime-graph.json` or derive sibling paths.
Code Generation (3.1, `workspace_requires: true`) is NEVER wave-eligible:
concurrent builders would collide writing into the shared workspace (the
swarm path's per-unit worktrees exist for exactly this isolation), and its
initial Plan Approval, while `plan_approval` is on, is a mandatory stop in every
execution mode: the engine's question to the person cannot fold into a builder's
return message. With `plan_approval` off (express and poc by default) the engine
builds the plan as written after one line naming it and records
`PLAN_APPROVAL_SKIPPED`. Under a `relaxed` or `off` Guard Policy the plan
re-approval fence stands aside for undirected work and records
`GUARD_STOOD_ASIDE` instead of refusing.
After approval, content edits for the same target and attempt follow the
effective-fence rule in Code Generation below; a lowered fence permits
continuation without another Plan Approval stop.

Each entry carries kind-resolved consumes, explicit absent consumes, all
produces, the applicable required subset, a Unit-local diary path, build state,
paired-review state, and whether its wave completion receipt is still required.
Builders receive the parent stage file, inline context roster, warnings, and
exact accumulated steering content. A blocked builder withholds an applicable
required path, not an optional or kind-exempt path. After build and review,
`unit complete --wave` verifies the live entry and emits `UNIT_COMPLETED`; each
Unit's notes stay in its own diary. The engine holds the
current batch until every applicable Unit has all of that evidence, then permits
a dependent batch or the single stage gate. Waves never apply under
`Construction Iteration: unit-major`; harnesses without a parallel dispatch
primitive process the entries serially. See
`stage-protocol-wave.md` § "Per-unit batch waves" for the full contract.

**Parallel batches.** Follow the exact dependency-ready Units emitted by the
engine. Explicit stage-major/swarm execution can dispatch eligible Code
Generation Units concurrently. In checkpoint-enabled workflows, each completed
batch returns a `swarm_checkpoint` for guided or automatic completion before
later work. Legacy swarm settlement retains its existing stage gate.
`BOLT_STARTED` / `BOLT_COMPLETED` are per Unit/worktree on the swarm path;
`SWARM_COMPLETED` closes the batch. Serial inline work uses its Unit lifecycle
and checkpoint receipts.

Each new Bolt worktree is `.aidlc/worktrees/bolt-<id8>_<slug>` on branch
`bolt-<id8>_<slug>`. The intent registry UUID suffix `<id8>` is shared with
Unit claims, so parallel intents can reuse Unit slugs without sharing branches
or retained/parked refs. Creation refuses an intent without a registry UUID;
adopt or re-create the intent before Build. See
[Bolt identity](../../../core/knowledge/aidlc-shared/worktree-info-schema.md#bolt-identity)
for naming and the provenance checks that let pre-upgrade legacy Bolts finish
without creating new Bolts in the old shape. Cleanup refuses a branch checked
out at another worktree path and preserves that owner's branch and refs.

A submodule the main checkout has initialized is set up in each new Bolt
worktree too, at the commit the base records, cloned from the main checkout's
own copy (no network or credentials). An uninitialized submodule stays an empty
directory. Landing keeps the worktree, and names the submodule, when its copy
there has uncommitted changes or a commit the main checkout's copy lacks. The
committed-source check reads an initialized submodule the way the live source
walk does, its commit plus its files, so a clean checkout with a submodule
matches its own `HEAD`.

Before initial protected prepare, all Units undergo a read-only preflight of
current approval or permitted postapproval continuation, plus committed,
reproducible parent application source. This
applies to legacy autonomy and new checkpoints. An uncommitted approved source
snapshot is refused before any child is created: obtain explicit authorization
to commit it, then retry. The inline skeleton's approved source must be committed
before a later parallel batch; prepare never makes that commit automatically.

A rejected batch with `resume_existing: true` uses `prepare --resume-existing`.
If rejection retired the prior approval, obtain fresh Plan Approval for the
revision. Retries after that approval may use lowered-fence continuation for
the same intent, target, and attempt: `execution_allowed: true` permits it even
with `ok: false`, without reviving an older attempt's approval.
Surviving worktrees retain source and archive prior
metadata. If native source landing removed a child, the tool can recreate it from
the already-landed parent source when the required landing evidence exists,
retaining the rejection revision. It does not promise preservation of every
post-merge child. See [Swarm prepare](../../guide/12-cli-commands.md#aidlc-engine-swarm-prepare-prepare-a-reproducible-batch).

**Failure handling.** A Code Generation failure always halts Build
regardless of autonomy mode. Options are retry (re-run just the failed
Unit), skip (mark `[S]` and continue — dependents may also fail), or abort.
Successful siblings in a parallel batch keep their `[x]` status and
artifacts. See `stage-protocol-checkpoint.md` and `stage-protocol-construction.md`
§ "Halt-and-ask on failure" for the canonical procedures.
The ordinary failure-prompt Abort pauses Build with the worktree
preserved. A stale-review recovery abort explicitly carrying `--discard` instead
parks tracked and non-ignored untracked files and reviewed source refs, then
removes the live checkout and branch. After obtaining the human's selection,
execute the returned abort command unchanged. When present, the abort result's
`restore_operation` has route `worktree` and exact args selecting the saved
slug, stamp, and repository (`--repo <name>` or `--repo .`), followed by
`--intent <record-dir-name> --space <space>` so recovery stays bound to that
intent after the active intent changes. On a human
restore request, invoke `{{INVOKE}} engine worktree <args...>` with each listed
arg passed exactly as a separate argv argument, never joined into a shell
command. Restoration recovers files in `.aidlc/restored/bolt-<id8>_<slug>-<stamp>` on
`restore/bolt-<id8>_<slug>-<stamp>`, without overwriting a new live Bolt or reviving the
old attempt's review authority. `restore_hint` is optional human display text
only, not execution input. If safe rendering fails, the hint is omitted and
`restore_hint_error` explains why while the operation remains. Offer restoration
based on the operation, not the hint. If only review evidence remained, the
`evidence-only` descriptor has no restoration operation, hint, hint error, or
exclusions: no working files were saved, restore refuses, and doctor offers
purge only.
The [recovery walkthrough](../../guide/15-troubleshooting.md#a-bolt-attempt-was-set-aside-getting-the-files-back)
explains what was set aside, the exclusions, exact restore selection, and
informational doctor listings and purge options. Legacy restores retain the
legacy name and require the selected intent's exact `WORKTREE_DISCARDED`
`Parked ref` provenance.


---

## Stage 3.1: Code Generation

### Metadata

| Property          | Value                                                                                             |
|-------------------|---------------------------------------------------------------------------------------------------|
| Stage             | 3.1                                                                                               |
| Phase             | Build                                                                                      |
| Execution         | ALWAYS (per-unit)                                                                                 |
| Condition         | Always executes for every unit in the execution plan.                                             |
| Per-Unit          | Yes                                                                                               |
| Lead Agent        | aidlc-developer-agent                                                                                   |
| support_agents    | (none -- focused implementation)                                                                  |
| mode              | subagent (Task tool subagent_type: aidlc-developer-agent)                                               |
| Inputs            | ALL prior design artifacts for this unit                                                          |
| Outputs           | application code (workspace root) + `<record>/build/{unit-name}/code-generation/` -- code-generation-plan.md, code-generation-questions.md, unit-test-instructions.md, code-summary.md, traceability.json, plus engine-required companion source-manifest.json (Unit work only) |

### Purpose

Generate all application code, tests, and configuration for a single unit of
work. It runs for every Unit in every scope that includes it.

Code is written to the workspace root, never to
`<record>/`.

### Critical Rules

- Application code goes to workspace root, NEVER to `<record>/`. The
  developer's one change there is ticking each step's box in the plan as it
  finishes that step
- Brownfield: modify files in-place. NEVER create duplicates like
  `ClassName_modified.java`
- Files already in the project that this work did not create (a README,
  LICENSE, docs, configs) are the person's, on a new project too: leave them
  as they are and build the code around them; this work's own notes on what it
  built with and how to run it go in `code-summary.md`, and its test command
  is already in `unit-test-instructions.md`. Change one of them only when the
  person asks for it or the work cannot be built without it (on brownfield,
  the code the work changes): name the change in the plan and say it once at
  the gate, naming the file and what changed in it, and the way back only when
  there is one
- Add `data-testid` attributes to interactive UI elements for test automation
- Work in this order: plan (Step 2), Step 3 (the person's Plan Approval; with
  plan approval off, only its one-line notice), generation (Step 4), the Step 5
  files, then the review (when the directive lists the `reviewer` protocol
  module) and completion (Step 6). The review checks the finished work: the
  reviewer never runs before the Step 5 files exist. When the directive
  already carries `plan_approval.status: "approved"` (a resumed or continued
  build), the plan and test instructions on disk are the approved ones: skip
  Steps 2 and 3 and build them as they are. Never rewrite an approved plan or
  its test instructions; change them only when the person asks
- For a Unit (`directive.unit` present), write the engine-required companion
  `source-manifest.json` in Step 5, before the review, listing every
  application-source path this unit created, modified, or deleted, including
  files written by shell commands, scaffolding, or generators. Zero-Unit work
  writes no `source-manifest.json`
- Measurable quality targets from NFR Requirements, NFR Design, and the Testing
  Contract coverage floor are inputs, not suggestions. NEVER relax, lower, or
  disable a defined target, including threshold settings in test or build
  configuration, to make a step pass; surface the gap instead.

### Inputs

- Functional design from
  `<record>/design/{unit-name}/functional-design/` (if exists)
- NFR requirements from
  `<record>/design/{unit-name}/nfr-requirements/` (if exists)
- NFR design from `<record>/design/{unit-name}/nfr-design/` (if exists)
- Infrastructure design from
  `<record>/design/{unit-name}/infrastructure-design/` (if exists)
- Domain design from `<record>/design/domain-design/`
- Unit definition from
  `<record>/design/units-generation/unit-of-work.md`
- Story map from
  `<record>/design/units-generation/unit-of-work-story-map.md`

### Steps

This stage has a **two-part structure**: planning followed by generation.

#### PART 1 -- Planning (Steps 1-3)

1. **Read All Unit Artifacts** -- Read all design artifacts for the current
   unit (functional design, NFR requirements, NFR design, infrastructure
   design, domain design, unit definition, story map).

2. **Create Code Generation Plan** -- Create a detailed plan at
   `<record>/build/{unit-name}/code-generation/code-generation-plan.md`
   with checkboxes for each implementation step. Include story-to-code-step
   traceability -- map each plan step back to the user story it implements.

   Run `aidlc-testing-posture.ts render` to read the Testing Contract the plan
   follows; `next` writes its `## Testing Contract` JSON block into the plan
   itself (a block that is missing, broken or out of date is replaced; the rest
   of the plan is kept, and after the person's own edit so are the words they
   wrote in that section, after the block). The resolver reads
   org/team/project Testing Posture sections additively: a project coverage or
   integration note remains applicable but does not erase a team methodology;
   a contradictory narrower methodology is rejected.

   The contract supplies a methodology-specific plan profile:

   - **TDD** -- Red/Green/Refactor for every applicable testable layer: data,
     repository, business logic, API, and frontend.
   - **BDD** -- executable behavior scenarios before an observable feature
     slice, followed by cross-layer implementation, green scenarios, and
     refactoring. It is not converted to layer-local TDD.
   - **ATDD** -- executable acceptance tests before the complete cross-layer
     feature implementation, run with their failing output recorded,
     followed by acceptance-green and refactoring.
   - **Custom/mixed** -- the exact affirmed ordering is preserved, including
     combinations such as scenario-first BDD with lower-level unit tests after
     implementation.
   - **Test-after** -- implementation then tests for every applicable testable
     layer.

   Greenfield plans bootstrap a minimal runnable test command before the first
   Red/scenario/acceptance step; brownfield plans verify the existing command
   first. The selected Test Strategy supplies volume/types and the scope adds
   its floor (coverage/CI, targeted regression, or no additional floor);
   neither obligation replaces the other. Under Minimal, a bug/security
   targeted regression may add one integration/E2E test when that is the
   narrowest level that reproduces the defect.

   **Test files are MANDATORY in the plan.** The plan MUST include steps for:
   - Unit test files (one per component/module with key behavior coverage)
   - Test configuration (vitest.config, jest.config, or equivalent)

   If the plan omits test file steps, they must be added before presenting to
   the user. Tests are not deferred to Build and Test -- that stage verifies
   and extends, not creates from scratch.

   Number each plan step sequentially (Step 1, Step 2, etc.) for clear
   execution ordering and traceability.

   Data-model elements are named, never implied: a step that creates or
   changes an object, entity, table, field or column names each one with the
   requirement, acceptance criterion, business rule or design element that
   asks for it. An element nothing upstream asks for also gets one plain line
   (not a checkbox) under the plan's `## Assumptions`, naming the step that
   adds it and why the work needs it, and the Summary's `Adds:` line counts
   and names it, so the person decides it at Plan Approval rather than
   finding it after deployment. A plan that adds no such element has neither.
   The developer agent builds no such element the approved plan does not
   name; one the build turns out to need goes into the plan first, as a step
   of its own, which the after-approval rules then treat as any other plan
   change.

   Resolve one code-generation record directory from the directive:
   `<record>/build/<directive.unit>/code-generation/` when
   `directive.unit` is present, otherwise the zero-Unit stage directory
   `<record>/build/code-generation/`. Also create
   `unit-test-instructions.md` there before Plan Approval. Match the active test
   strategy:
   - **Minimal**: Requirement-driven unit tests (1 test per requirement,
     happy-path floor per component), approximately 5-15 tests total
   - **Standard**: 5-8 tests per component, with key behavior coverage
   - **Comprehensive**: 10-15 tests per component, with thorough coverage

   Include test framework setup and configuration, the exact runnable command
   available before the first test-first cycle, expected coverage targets,
   mocking/stubbing guidance, and test data management. Every run command MUST
   be scoped to this unit using exact test file paths or an exact unit filter.
   A bare project-wide command such as `npm test` is not acceptable because
   Build and Test executes every unit's commands. A coverage floor set for the
   whole project is measured by Build and Test on the full suite, not by these
   commands (on one Unit's tests a runner's threshold can fail on source other
   Units' tests cover); the file names the floor, and the floor's threshold in
   the project's coverage configuration is never changed to make a Unit's run
   pass. A command that the floor's threshold can fail keeps no step after it
   that the threshold exit would stop, because Build and Test does not exempt
   a command whose exit stopped a later step. A coverage target set for the
   Unit or one of its paths gets its own Unit-scoped check.


   The plan opens with a short `## Summary` (Builds, Touches and Tests lines,
   and an Adds line when the plan adds an element no requirement asks for)
   that the engine shows the person when it asks for approval.

3. **Plan Approval** -- the engine asks. When both files are written, the
   conductor runs `next`. A ready plan (non-empty plan and instructions, a
   valid and current Testing Contract, which `next` writes first, a readable
   workspace source) makes
   `next` return a `plan-approval` ask instead of the build: the question, each
   target's summary and plan path, and **Approve Plan**, **Request Changes**,
   and **I'll edit the files**. The engine writes `code-generation-questions.md`
   (the question, both tags, and a blank `[Answer]:`) and records the question
   in the protected runtime directory; the conductor shows it and ends the turn.
   The human-turn hook keeps every reply of the person's after the question,
   from any chat on this piece of work, and picks nothing from typed words (a
   pick in a question box is the host's own structure); the conductor reads
   which question a reply answers and records their choice with
   `answer --checkpoint plan-approval`,
   which takes the fingerprint of the files as they
   are then and writes the answer, the receipt, and the `PLAN_APPROVAL_RECORDED`
   row with the person's words. The person may instead write their answer on the
   questions file's own `[Answer]:` line, as that file invites, and say so: the
   engine never overwrites an answer they wrote there while the same question
   stands. When they say so, in any words ("done", "I put my answer in the
   file"), the conductor reads the line and records the choice they made; the
   line itself approves nothing, the engine's receipt does. When the person's message in
   this chat that the question opened for already asked for a change ("go back
   to code generation: also accept -S", on finished work too, or a redo of one
   Unit's step that names its change) and no decision but the redo or jump it
   asked for has used it, the conductor records it as that question's Request Changes,
   with their words (the message record is the proof, as `--message` reads
   it); an approval still needs a reply after the question shows, and the
   revised plan's question needs its own. The
   next `next` returns the run-stage with `plan_approval.status: "approved"`
   (build), `revise` (with the person's words), `repair` (what their answer
   could not record), or `plan` (finish the files). In edit mode the person changes the
   files or writes their answer in the questions file and says done, and the
   conductor reads what they wrote and records their choice; the guard refuses
   the conductor's writes to those files meanwhile. A plan that is not
   ready is never asked about: `next` names the repair instead.

   A postapproval plan, instruction, or Testing Contract edit for the same
   target and attempt asks again under Guard Policy `strict`. Under `relaxed` or
   `off` the build continues with the updated content. Preserve the original evidence; the edited content was not
   thereby approved. Testing Posture, scope, strategy, or project type changes
   follow that same rule. Other code moving after approval never asks again on
   any Guard Policy: the build continues with one `change_notices` line naming
   the files. A swarm under `strict` is the exception for the person's own
   files: prepare refuses until the plan is approved again, and the source
   landing refuses the same change until it is undone or Guard Policy is
   `relaxed`. A different intent or target, a new attempt, or missing actual
   initial approval still requires its own approval. After a rejected gate (the
   Code Generation completion gate, a Unit checkpoint, or a swarm batch
   checkpoint), while the plan is still the one approved before, `next` first
   returns `revise` with the person's words from that gate, so the question
   that follows shows the revised plan. Reopening the step through
   `/aidlc --stage code-generation` (`Reopen: jump`) or Redo (`Reopen: redo`)
   starts a fresh attempt and asks about the plan as it stands, without
   requiring an arbitrary edit. `Reopen: change` and a gate's Request Changes
   still return `revise` with the person's feedback. Re-running `next`, or a
   reissued directive for the same target and attempt, never reopens it, and
   neither does whatever the engine said in between: a chat that compacted, a
   piece of work parked and resumed, or a guard-recovery question. `next` reads
   the approval for the plans its routed directive builds, not for the
   directive it replaces. A forwarding-loop continuation is never approval.

   `testing-posture verify` reports `execution_allowed: true` with exit 0 when
   continuation is permitted, even if `ok: false` says the current content is
   not approved. Use that execution result; `begin` and `brief` honor it too.
   The friendly `reason` explains continuation; `approval_reason` keeps the
   stale binding detail and is not a new approval stop. When both content and
   source changed, read-only `verify` also previews the source change in
   `change_notices`. Generation start, including guard dispatch and swarm
   preparation, records and announces the accepted source change and
   re-baselines source provenance under the lowered fence. The original
   approval fingerprint, answer, and session remain unchanged. Existing delegated
   workers follow the live fence of their verified parent intent, including
   later lowering or raising.
   Missing artifacts or malformed or structurally incomplete Testing Contracts
   need repair before execution, not an automatic new approval ceremony.
   `obligations.strategy` must match `test_strategy`; both `strategy_volume`
   and `scope_floor` must contain nonblank obligations.
   A lowered fence also leaves execution provenance mandatory: before generation
   starts, an unbindable source or a failed runtime/audit publication blocks the
   operation. Repair that operational failure and retry with the same approval
   and fence setting. A valid human-issued break-glass receipt retains its
   existing source-binding exception.
   Lowering the per-work fence does not replace genuine initial approval,
   executable artifacts, or current target/attempt authority. Direct writes and
   developer dispatch validate every selected target before publishing any
   generation start. Repairing the plan records remains available while those
   execution requirements are unmet.
   A dispatch selecting multiple targets holds the generation authority locks
   across the whole start. If any target fails or source changes during
   publication, every receipt newly started by that dispatch is restored.
   Retry then checks the current source again; the original approvals and
   lowered fence settings remain unchanged.

#### PART 2 -- Generation (Steps 4-7)

4. **Generate Code** -- The directive's `narration` is the user's line for
   this build, said once before delegating. The engine counts the plan from
   the plan file, once for both lines:
   "Generating unit-2's code for 9 plan steps. This may take several minutes
   depending on project complexity. I'll show a summary when complete." at
   the start, and where an interrupted build picks up ("Picking up unit-2's
   code at step 5 of 9 (1-4 done)."; with the code written and no step marked,
   "Picking up unit-2's code: the plan marks none of its 9 steps done, checking
   what is built."). When the plan groups its tasks under
   "Step N" headings, both lines count the tasks and name the heading
   ("Generating unit-2's code for the 19 tasks in 4 plan steps ...", "Picking
   up unit-2's code at task 7 of 19, in Step 3 (tasks 1-6 done)."). The agent
   never counts the steps itself.

   Delegate to Task tool with the aidlc-developer-agent subagent
   (subagent_type="aidlc-developer-agent").

   **Context passed to subagent:**
   - First, verbatim, the output of `aidlc-testing-posture.ts brief --unit
     <unit>` (or `--stage-level`). Its first line is the exact target marker,
     `AIDLC-UNIT: <directive.unit>` for unit work or
     `AIDLC-STAGE: code-generation` for a zero-Unit directive; its second line
     is `AIDLC-TESTING-CONTRACT: <contract_sha256>` from the current plan. With
     its fence on, the dispatch guard rejects missing, different, or stale
     hashes. Contextual dependencies do not receive additional target markers.
   - Design artifacts for the CURRENT UNIT ONLY (not all units)
   - A 1-2 line summary of each design-phase artifact with its file path
     (requirements summary, stories summary, domain design summary) -- the
     subagent can Read specific files if it needs full content
   - The current plan and unit-test-instructions.md, which that
     output already carries using the approval-content projection: the plan
     with a terminal `## Review` appendix removed, task markers reset, and
     spacing normalized, plus the instructions byte for byte. The fingerprint
     excludes the appendix, so it is not work to execute; with its fence on,
     the dispatch guard refuses a handoff that quotes it. After permitted
     postapproval edits, use the current brief without calling the edits approved
   - When a build of the same plan was interrupted, that output also
     carries a `## Progress before the interruption` section after its marker
     lines: the steps the plan file ticks (or, with none ticked, the steps
     whose named files changed since the build started), each file a done step
     names in a code span that is not in the project (a bare file name counts
     when a file of that name is anywhere in it), stated as a fact for the
     worker to judge, and the step to continue at. When neither the ticks nor
     the named files say what is done, it says the build wrote code and the plan
     marks none of its steps, and asks for each finished step to be ticked.
     It appears only when the
     build already started on the plan and instructions as they stand (the
     receipt for this target, stage attempt, and approved content is at
     `generation`, and the content on disk is the approved content or, when
     the fence was lowered for a plan edited after its approval, the edited
     content generation start kept on that receipt); a Redo, a rejected gate,
     a new approval, or a plan edited after the build started starts the steps
     fresh. When a build starts
     under a new approval, the engine sets the plan file's task markers back to
     `[ ]` (nothing else in the file changes, and the fingerprint is the same),
     so ticks from before never count. A swarm batch keeps its own
     continuation rule. The section is a hint, never evidence for a gate,
     review, or receipt, and ticks stay outside the fingerprint
   - Project workspace details (languages, frameworks, conventions from
     aidlc-state.md)
   - Instructions to execute each plan step sequentially and mark checkboxes
     as completed, starting where that progress section says when present
   - The Testing Contract in the current brief is authoritative. The subagent
     does not independently re-resolve memory; it executes that contract's TDD, BDD, ATDD,
     test-after, or custom/mixed profile exactly.
   - Measurable quality targets from NFR Requirements, NFR Design, and the
     Testing Contract coverage floor are inputs, not suggestions. The subagent
     must NEVER relax, lower, or disable a defined target, including threshold
     settings in test or build configuration, to make a step pass; it must
     surface the gap instead.

   **Context budget:** Pass only the current unit's design artifacts, not all
   units. Summarize design artifacts with file paths rather than embedding
   full content. The subagent generates all code, test files, and
   configuration artifacts in the workspace.

5. **Generate Code Summary and Source Manifest** -- After the subagent
   completes, create
   `<record>/build/{unit-name}/code-generation/code-summary.md`
   documenting:
   - Files created/modified
   - Key implementation decisions
   - Test coverage summary
   - Any deviations from the plan

   For a Unit (`directive.unit` present), also create
   `<record>/build/<directive.unit>/code-generation/source-manifest.json`.
   This is a strict version-1 JSON companion file, not a declared `produces[]`
   artifact. It records `stage: "code-generation"`, the exact unit name, and a
   `writes` array containing every application-source path the unit created,
   modified, or deleted, including shell-, scaffolding-, and generator-written
   files. Paths are POSIX-relative and use no globs or `..`; a trailing `/`
   claims a generated directory tree. In a main-workspace multi-repo run every
   entry names its recorded `repo`; inside the worktree hosting the Bolt, paths are relative
   to that selected repo and omit `repo`. An entry read in a recorded repo gives its path
   from that repo's root: one the repo does not have counts as deleted only when the repo
   had it (at HEAD, in a commit before it, or, for a file, in a folder still on disk), and
   any other (`{"repo": "billing", "path": "billing/package.json"}`) is refused before the
   review, every such entry named in one reason. When the work records a git submodule of
   the project as its only repo (work started before such a submodule stopped being
   recorded) and every entry is a file of the project's own, the reason asks the person
   once whether to take the submodule off the work's repos (`intent remove-repo`), after
   which the manifest reads as written, or to put the code in the submodule.

   The stage file gives this shape:

   ```json
   {
     "stage": "code-generation",
     "unit": "u1-auth",
     "version": 1,
     "writes": [
       { "path": "src/auth/login.ts" },
       { "path": "src/auth/generated/" },
       { "repo": "repo-a", "path": "src/api/routes.ts" }
     ]
   }
   ```

   The engine validates this schema and refuses to record a terminal per-unit
   review without it. Its bytes and claims join the `Unit Source Fingerprint`.
   Under Guard Policy strict, changed stage-source paths outside all fresh
   reviewed manifests block completion; under relaxed or off they are kept and
   the person is told once which files changed outside the Units.

   A zero-Unit directive (`directive.unit` absent) writes no
   `source-manifest.json` and creates no Unit directory for one: the engine
   reads the manifest only for a Unit, and a zero-Unit review binds the whole
   workspace source instead. Its Step 5 files are
   `<record>/build/code-generation/code-summary.md` and
   `<record>/build/code-generation/traceability.json`.

6. **Review, then Prepare Completion** -- When the directive lists the
   `reviewer` protocol module, the architecture reviewer checks the finished
   work first (plan, test instructions, code summary, traceability, and, for a
   Unit, the source paths `source-manifest.json` claims), per section 12a of
   `stage-protocol-reviewer.md`. The review is recorded against
   `code-generation-plan`, the stage's `review_artifact`; that names where the
   review is filed, not a review of the plan before it is built. For a Unit the
   engine refuses the review request until the Step 5 files exist. Then verify
   the unit's code and summary artifacts. Do not edit state; report the gate
   outcome through `aidlc-orchestrate.ts`.

7. **Completion** -- Present completion message and approval gate.

### Outputs

| Artifact                  | Description                                                         |
|---------------------------|---------------------------------------------------------------------|
| code-generation-plan.md   | Detailed plan with checkboxes, story traceability, step sequencing, and an Assumptions section when it adds a data-model element no requirement asks for |
| code-generation-questions.md | Persisted Plan Approval question and explicit human answer       |
| unit-test-instructions.md | Per-unit setup, scoped run commands, coverage, mocks, and test data |
| code-summary.md           | Files created/modified, decisions, test coverage, plan deviations   |
| traceability.json         | Structured coverage of assigned upstream IDs by code/test targets   |
| source-manifest.json      | Engine-required strict companion attribution index, Unit work only; deliberately not in `produces[]` |
| (application code)        | All source code, tests, and config written to workspace root        |

### Approval Gate

Strictly 2-option: Approve / Request Changes.

### Notes

- **Two-part structure**: The planning phase (Steps 1-3) runs inline with user
  interaction and plan approval. The generation phase (Steps 4-7) delegates to
  the aidlc-developer-agent subagent via the Task tool. This is different from most
  stages which run entirely inline.
- **Developer-agent subagent**: Code generation uses `subagent_type="aidlc-developer-agent"`
  (delegated via Task tool), not inline execution. This is the only
  stage that uses a subagent. The aidlc-developer-agent declares
  no `tools:` allowlist and denies `Task`.
- **Context budget**: Only the current unit's design artifacts are passed to
  the subagent. Design-phase artifacts are summarized in 1-2 lines with
  file paths so the subagent can selectively Read what it needs.
- **Mandatory test file inclusion**: Test files MUST be part of the code
  generation plan. Stage 4.1 (Build and Test) verifies and extends tests but
  does not create them from scratch.
- **Source-manifest enforcement** (Unit work only): `source-manifest.json` is engine-validated,
  not a Markdown `required-sections` target. Its strict schema and
  `Unit Source Fingerprint` bind every exact/directory source claim; the engine
  refuses the terminal review when it is absent or invalid and, under Guard
  Policy strict, refuses stage completion for changed source outside the fresh
  reviewed claims union.
- **Unit-scoped execution**: Each per-unit test instruction file uses exact
  test paths or an exact unit filter so the cross-unit execution stage does
  not rerun the project-wide suite for every unit.
- **Brownfield awareness**: In brownfield projects, the subagent modifies
  existing files in-place rather than creating duplicates.


---

## Phase Summary

The Build phase generates the code for each unit of work, from the unit designs
that the Design phase produces.

- **3.1 Code Generation** -- two-part planning and generation through a subagent
  (developer-led), once for each unit in the execution plan.
- **Per-unit design stages.** Before Code Generation, each unit may run
  Functional Design (2.9), NFR Requirements (2.10), NFR Design (2.11) and
  Infrastructure Design (2.12), each CONDITIONAL. Which of them run comes from
  the plan (the scope, plus any skip or add the person makes), not from Delivery
  Planning; each still applies its own condition.
- **Context budget.** Only the current unit's design artifacts are passed to the
  subagent; the rest are summarized with their file paths.
- **Build and Test** (4.1), in [Test](test.md), runs once after all the unit work
  and performs command execution and automated failure diagnosis.
- **Phase boundary.** The Build phase boundary is verified by CI Pipeline (6.1),
  in [Deploy](deploy.md).

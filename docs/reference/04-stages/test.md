# Test Phase -- Stage Reference (4.1-4.2)

## Phase Overview

Test is the fourth of the seven phases in the AI-DLC lifecycle. It follows
Build. It has two stages, numbered 4.1 and 4.2.

Build and Test (4.1) is an ALWAYS stage. It executes once, after all per-unit
stages have finished. Performance Validation (4.2) is CONDITIONAL: it executes
when performance targets need validation under load.

Support agents take part only when collaborators are on (the `collaborators`
setting, shipped on only for `enterprise`; `/aidlc --collaborators on` turns it
on for one piece of work). With collaborators off, the engine hands each stage
an empty `support_agents` list and the lead runs alone. Build and Test is the
only Test stage with a support agent: `aidlc-devsecops-agent` supports it when
collaborators are on.

## Stage Summary Table

| Stage | Name | Condition | Lead Agent | Support Agents | Mode |
|-------|------|-----------|------------|----------------|------|
| 4.1 | Build and Test | ALWAYS | `aidlc-quality-agent` | `aidlc-devsecops-agent` | inline |
| 4.2 | Performance Validation | CONDITIONAL | `aidlc-quality-agent` | -- | inline |

## Scope Applicability

The compiled grid (`EXECUTE` in `scope-grid.json`) lists the Test stages each
scope plans:

| Scope | Stages that run |
|-------|-----------------|
| bugfix | 4.1 |
| classic | 4.1 |
| enterprise | 4.1, 4.2 |
| express | 4.1 |
| feature | 4.1, 4.2 |
| infra | 4.1 |
| mvp | 4.1 |
| poc | 4.1 |
| refactor | 4.1 |
| security-patch | 4.1 |
| workshop | 4.1, 4.2 |

The Secure phase (code review, security review and conformance review) follows
Test, and [Deploy](deploy.md) follows Secure.

---

## Stage 4.1: Build and Test

### Metadata

| Property          | Value                                                                                             |
|-------------------|---------------------------------------------------------------------------------------------------|
| Stage             | 4.1                                                                                               |
| Phase             | Test                                                                                      |
| Execution         | ALWAYS (after ALL units complete)                                                                 |
| Condition         | Always executes once after all per-unit stages are finished.                                      |
| Per-Unit          | No (runs once for all units)                                                                     |
| Lead Agent        | aidlc-quality-agent                                                                                     |
| support_agents    | aidlc-devsecops-agent                                                                                   |
| mode              | inline                                                                                            |
| Inputs            | ALL code generation outputs across all units                                                      |
| Outputs           | `<record>/test/build-and-test/` -- build-instructions.md, build-and-test-summary.md, test-results.md; strategy-dependent (declared under `optional_produces`): integration-test-instructions.md (Standard and above), performance-test-instructions.md and security-test-instructions.md (Comprehensive, when that NFR kind exists), plus other conditional test instruction files |

### Purpose

Generate cross-unit test instructions, consume the per-unit unit test
instructions, then actually execute the build and tests via Bash. This stage
operates across ALL units -- it is NOT per-unit. The aidlc-quality-agent leads
with the aidlc-devsecops-agent providing security testing expertise.

### Inputs

- Code generation outputs across all units from
  `<record>/build/*/code-generation/code-summary.md`
- Per-unit test instructions from
  `<record>/build/*/code-generation/unit-test-instructions.md`
- Every applicable artifact under each unit's `nfr-requirements/` and
  `nfr-design/` directory
- Every current `## Testing Contract` in the stage-level or per-unit
  `code-generation-plan.md`, including postapproval edits permitted by a lowered
  plan re-approval fence and plans built with plan approval off; neither is
  described as human-approved. A CI obligation (the contract's "Run the selected
  tests in CI before merge." line, or a memory note's "CI execution before
  merge") is a target only when the plan runs CI Pipeline (`ci-pipeline` listed
  as `EXECUTE` and not `[S]` in `aidlc-state.md`); otherwise it is recorded
  `N/A` with that reason and is never a failure. While CI Pipeline is still
  ahead (`[ ]`), the target is CI Pipeline's to meet: recorded `N/A` with Owning
  Stage `ci-pipeline` and the reason that CI Pipeline, later in the plan, sets up
  CI to run these tests before merge, never a failure

### Steps

1. **Analyze Testing Requirements** -- Read code generation summaries and
   per-unit test instructions across all units. Build a source-complete
   inventory of every measurable target from NFR Requirements, NFR Design, and
   every current Testing Contract. For each target, record a stable ID, source
   path/section, expected value, the check that produces its actual value, and
   any later validation stage that owns it. Catalog all required test types.

2. **Generate Build Instructions** -- Create
   `<record>/test/build-and-test/build-instructions.md`:
   - Dependency installation steps
   - Environment setup (env vars, config files, local services)
   - Build commands (compile, bundle, transpile)
   - Build verification steps
   - Troubleshooting common build issues

3-7. **Generate Additional Test Instructions** -- Consult the active test
   strategy and generate the matching cross-unit instruction files:
   - **Minimal**: Generate no additional files. Unit tests are covered
     per-unit by Code Generation.
   - **Standard**: Generate `integration-test-instructions.md` for key
     boundaries and cross-unit interactions.
   - **Comprehensive**: Generate integration instructions, plus
     `performance-test-instructions.md` when performance NFRs exist and
     `security-test-instructions.md` when security NFRs exist.
   - At any strategy, add specifically named contract, E2E, accessibility, or
     other instruction files when the project context requires them.

   All files go in `<record>/test/build-and-test/`.
   Each file includes framework setup, run commands and filters, coverage
   targets, and test data or environment setup.

8. **Generate Build and Test Summary** -- Create
   `<record>/test/build-and-test/build-and-test-summary.md`:
   - Overall build status and prerequisites
   - Test type inventory (which test types were generated)
   - Coverage expectations for the project and each Unit
   - A Target Verification Matrix with Target ID, Source, Expected, Actual,
     Evidence, Owning Stage, and Verdict
   - Applicable targets begin `Pending`; `N/A` is valid only when the
     source-complete inventory found no applicable measurable target, or for a
     target the plan makes inapplicable here (the CI obligation of a plan that
     runs no CI Pipeline or has it still ahead)
   - Readiness assessment (build-ready, test-ready, deployment-ready)
   - Known limitations or outstanding items

9. **Execute Build and Tests** -- Attempt to execute the build and test
    commands documented in the instruction files **via Bash**:

    a. **Build**: Run the build commands from build-instructions.md via Bash.
       Capture output.
    b. **Unit tests**: Collect commands from the stage-level
       `<record>/build/code-generation/unit-test-instructions.md` (when
       present, including Express) and every per-unit
       `code-generation/unit-test-instructions.md`, deduplicate identical
       commands, and run each distinct command once. Commands should be
       unit-scoped; if a file contains a project-wide command, run it once,
       never once per unit. Report per-unit pass/fail without double counting.
       When a coverage floor is set for the whole project, the project's
       full-suite coverage command runs once with its own coverage
       configuration (in a multi-repo intent, once in each repository the
       floor applies to, with the repository named in the row's Evidence),
       and that run is the evidence for a project-wide floor row in the
       Target Verification Matrix; one repository's run is never the
       evidence for another repository's floor. A unit-scoped command, from a
       new or an already-approved file, whose output shows all its selected
       tests passed and the project-wide floor's threshold (one for all
       measured source, even when the runner checks it file by file) as the
       only cause of its non-zero exit counts as passed, with its exit and the
       reason recorded in test-results.md. That applies only when that exit
       stopped no later step of the command: when a step after it did not run
       because of it (one chained, such as `… && <lint>`, one in a script or
       lifecycle hook the command calls, or a later task or phase of a build
       tool; tell from the scripts, hooks and task or phase definitions the
       command runs and from its output), the command is not exempt and its
       non-zero exit is a failed command. Any other non-zero exit (including a
       threshold set for one path or Unit) is a failure. A
       target set for one Unit needs its own Unit-scoped evidence.
    c. **Integration tests** (if applicable): Run integration test commands.
       Capture results.
    d. **Other applicable checks**: Run every applicable command from
       performance, security, contract, E2E, accessibility, and other generated
       instruction files. Defer only a check that requires a deployed or
       production-like environment and has a named owning validation stage in
       the current execution plan. Record that stage and its expected evidence
       path; the target remains `Unverified` and cannot make this stage
       successful. Without a scheduled owning stage, it is simply
       `Unverified`.
    e. **Finalize and report results**: Create or update
       `<record>/test/build-and-test/test-results.md` and
       `build-and-test-summary.md` on every exit path with:
       - Build status (success/failure + output)
       - Test results (total, passed, failed, skipped)
       - Failure details (test name, assertion, stack trace)
       - Coverage report (if test framework supports it)
       - The finalized Target Verification Matrix. Every applicable target has
         an actual value, evidence, owning stage, and final `Met`, `Not Met`, or
         `Unverified` verdict. No `Pending` verdict remains after Step 9.
       - `## Loop-Back Log` (only when the failure ladder's rung 3 or 4 fires
         a loop-back): one `### Loop-back N -- <ISO timestamp>` entry per
         attempt (Diagnosis / Root-cause stage / Planned fix / Estimated impact).
         Append-only; survives re-runs (Modify, never Redo, on loop-back
         re-entry).

    **Failure-escalation ladder:** The stage has failed when a build or test
    command fails or an applicable target is `Not Met` or `Unverified`. Finalize
    the matrix and summary before entering the same ladder for every failure
    kind. Lowering, relaxing, or disabling a target is never an acceptable fix.

    1. **In-stage fix (max 2 attempts)** -- for root causes inside this
       stage's own remit (test config, build scripts, environment setup, or an
       executable target check): read the evidence, identify the failing
       configuration or scaffolding, apply the fix, re-run the failing step,
       and refresh the target matrix.
    2. **Classify and estimate impact** -- when in-stage attempts are exhausted or the
       diagnosis points upstream: decide whether the root cause lies in
       generated source or test code -- regardless of defect size -- or a
       code-generation approach choice (library/version, container image,
       instance type, algorithm, flag); find a fix in a swappable dimension
       and ESTIMATE ITS IMPACT (effort, financial cost, risk). Never declare a
       feasible path out of scope on an impact-unestimated effort assumption.
    3. **Autonomous bounded loop-back** -- if `Construction Autonomy Mode:
       autonomous`, an impact-estimated fix exists, and fewer than 3 entries exist under
       `## Loop-Back Log`: record the diagnosis + impact-estimated fix, reopen
       code-generation via the engine for the Unit(s) the fix names (every Unit
       only when the cause spans them all), and replay forward through its
       settlement-aware route per the loop-back protocol module
       (`aidlc-common/protocols/stage-protocol-loopback.md`),
       "Build-and-Test failure loop-back". The failed run's gate is not
       presented; its enabled learnings ritual defers to the eventual passing run. When the `learnings` module is absent, no diary or ritual runs.
    4. **Halt-and-ask** -- gated/unset mode, bound exhausted, or no
       identifiable fix: log the failure and present the halt-and-ask
       question from the loop-back protocol module
       (`aidlc-common/protocols/stage-protocol-loopback.md`) -- the
       impact-estimated 3-option variant (Retry with fix [estimated impact] /
       Accept failure / Abort) when a candidate fix exists, or the no-fix
       2-option variant (Accept failure / Abort) when rung 2 found none.

    **Loop-back replay routing:** If Construction checkpoints are off and Code
    Generation never used unit lifecycle receipts, preserved artifacts can take
    the all-covered `gate: true` fast path; apply the planned fix and
    deterministic Modify/Keep decisions before that gate. With checkpoints on
    (receipts are required from the first Unit), or once any lifecycle row
    exists, receipt mode is sticky and the
    jump re-emits per-Unit work: re-mint `unit start` / `unit complete`, apply
    Modify to targeted Units and Keep to the rest, and run the declared reviewer
    per Unit. Both paths MUST record a fresh current-attempt
    `REVIEW_COMPLETED` for every reopened Unit before the settle/approval
    gate because the reopen invalidates those Units' earlier reviews; Units the
    fix does not name keep their work and approvals. Under
    unit-major the swarm never fires; replay follows the serial per-Unit walk.
    A revised Code Generation plan still requires fresh human Plan Approval.

    The replay repairs the Code Generation plan under a NEW stage attempt, so the
    prior approval no longer applies. Record the delta in the Loop-Back Log and
    write the repaired plan; `next` then asks the person for Plan Approval again
    before any fix generation. The gated "Retry with fix" choice authorizes the
    jump; it is not approval of the revised plan.

    **Swarm cheap path:** A jump creates a new exact stage-attempt `Run floor`
    boundary token, so stale convergence rows cannot count. Park/discard stale
    worktrees/branches and run a fresh `prepare`; they cannot be adopted into
    the new attempt because `finalize` requires its current prepare stamp.
    The saved abort result's or doctor's `restore_operation`, when present,
    recovers parked files separately, not their current-attempt authority.
    Invoke its `worktree` engine route with each listed arg exactly as argv,
    never joined into a shell command. Hints and rendered commands are human
    display text only; rendering errors do not remove typed operations.
    Evidence-only attempts have no restore operation or files to restore. Run
    `check` first. A green Unit can skip a builder turn, but it still needs a
    terminal current-attempt reviewer receipt in the fresh worktree before it
    enters `finalize --claimed`; `finalize` verifies that receipt's current
    artifact fingerprint as well as the attempt stamp.

    Single-stage runs (`--single`) stop at rung 2 -- there is no
    main-workflow position to move; the impact-estimated options are logged and
    presented in that run's isolated-run summary.

    **On success:** A successful readiness result requires every command to
    pass and every applicable target to be `Met`, or the single explanatory
    `N/A` row when no target applies.

10. **Cross-Unit Final Coverage Gate** -- Run
    `aidlc engine sensor-traceability --stage build-and-test`. It reports every
    `FR` and `NFR` in `requirements.md` (a requirement with sub-requirements
    through its `FR{n}.{m}` IDs) and every `AC` in `stories.md` (when User
    Stories ran), each built when a stage-level or per-unit Code Generation
    `traceability.json` covers it `OK` with an existing target file. A
    requirement with sub-requirements is built when each Unit has built its own
    (the `NFR1.x` its NFR Requirements wrote; a row for `NFR1` alone does not
    cover them); otherwise by its own row or, when User Stories ran, through
    every acceptance criterion of the stories User Stories traced it to. One
    that nothing builds is settled when the latest stage that traced it (User
    Stories, NFR Requirements, then Code Generation) marked it `N/A` with its
    reason in every table there that lists it; an `N/A` with no reason is not
    settled. A story Units Generation kept out of every Unit, `Deferred` with
    its reason, settles its criteria the same way (a requirement, in work
    without stories), unless a later stage's table lists them. A Code Generation
    `N/A` whose target names another Unit on its own, by directory or `U{n}` ID,
    hands the ID to that Unit and settles nothing: if no Unit built it, it is
    uncovered and its row lists the hand-offs as `handed_off`.
    Write
    `cross-unit-traceability.md` from that output with the verdict, per-ID
    coverage and every uncovered ID; an uncovered ID is a finding shown at the
    approval gate.

11. **Prepare Completion** -- Verify the build/test evidence. Do not edit
    stage or phase state; the reported gate outcome owns the transition.

12. **Completion** -- Present completion message and approval gate.

### Outputs

| Artifact                          | Description                                                     | Condition          |
|-----------------------------------|-----------------------------------------------------------------|--------------------|
| build-instructions.md             | Dependency install, env setup, build commands, troubleshooting  | Always             |
| integration-test-instructions.md  | Prerequisites, cross-unit testing, external deps, data setup    | Standard/Comprehensive |
| performance-test-instructions.md  | Load testing, NFR scenarios, baselines, stress/soak tests       | If NFR perf exists |
| security-test-instructions.md     | SAST/DAST, auth testing, injection testing, compliance          | If NFR sec exists  |
| contract-test-instructions.md     | Consumer-driven contracts, schema validation, API compat        | If microservices   |
| e2e-test-instructions.md          | Browser automation, user journeys, cross-browser                | If UI-driven       |
| accessibility-test-instructions.md| WCAG compliance, screen reader, keyboard nav                    | If user-facing UI  |
| build-and-test-summary.md         | Overall status, test inventory, coverage, readiness assessment  | Always             |
| test-results.md                   | Actual build/test execution results, pass/fail, coverage        | Always             |
| cross-unit-traceability.md        | FR/NFR/AC coverage across all Units, verdict, uncovered IDs     | Always             |

### Approval Gate

Strictly 2-option: Approve / Request Changes.

### Notes

- **Actual Bash execution**: This stage does not just document test
  instructions -- it actually runs the build and test commands via Bash and
  captures real results. This is one of the few stages that executes
  real commands against the codebase.
- **Quality target evidence**: The source-complete matrix is finalized on every
  exit path. Deployed-environment checks may name a later owning stage, but
  remain `Unverified`; `Not Met` and `Unverified` both enter the failure ladder.
- **Failure-escalation ladder**: In-stage fixes are bounded at 2 attempts;
  when the root cause lies upstream in generated code or a code-generation
  approach choice, the stage classifies and estimates the impact of a fix, then either runs
  the bounded autonomous loop-back to code-generation (max 3, counted by the
  append-only `## Loop-Back Log` in test-results.md) or presents the impact-estimated
  halt-and-ask question. See the loop-back protocol module
  (`aidlc-common/protocols/stage-protocol-loopback.md`),
  "Build-and-Test failure loop-back". Re-entry is settlement-aware, asks for
  Plan Approval again on the repaired plan while `plan_approval` is on (the
  earlier approval belongs to the previous attempt), and cannot reach its gate until every applicable Code
  Generation Unit has a fresh current-attempt review.
- **Conditional test types**: Performance tests, security tests, contract
  tests, E2E tests, and accessibility tests are only generated when relevant
  conditions are met (NFR requirements exist, microservice architecture,
  UI-driven application, user-facing interfaces).
- **Cross-unit scope**: Unlike stages 2.9-3.1 which are per-unit, Build and
  Test runs once across all code produced by all units. It validates the
  integrated codebase, not individual units.
- **Phase completion**: This stage (along with 4.2 if applicable) marks the
  end of the Test phase. The final approved report makes the engine
  mark Test complete and route on to the next phase atomically.


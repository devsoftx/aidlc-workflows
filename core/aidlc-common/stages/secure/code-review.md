---
slug: code-review
name: Code Review
phase: secure
execution: ALWAYS
condition: Always executes once after build-and-test; the review covers every unit's code.
lead_agent: aidlc-quality-agent
support_agents: []
mode: inline
produces:
  - code-review-report
  - code-review-findings
consumes:
  - artifact: code-summary
    required: true
  - artifact: build-and-test-summary
    required: true
requires_stage:
  - build-and-test
scopes:
  - enterprise
  - feature
  - mvp
  - poc
  - bugfix
  - refactor
  - security-patch
  - infra
  - classic
  - workshop
  - express
sensors:
  - required-sections
inputs: code summaries and build-and-test results for every unit
outputs: "code-review-report.md and code-review-findings.md (under this stage's record dir, engine-resolved)"
---

# Code Review

## Steps

### Step 1: Gather the Code to Review

Read every unit's code summary from `<record>/build/<unit>/code-generation/code-summary.md` (for a zero-Unit scope, `<record>/build/code-generation/code-summary.md`)
and the build-and-test summary from `<record>/test/build-and-test/build-and-test-summary.md`.
Identify the source files that changed for each unit, using the source manifest
where one exists.

### Step 2: Review Each Change

For each changed file, check correctness against the unit's functional design,
error handling, edge cases, naming and readability, test coverage for the new
behavior, and dead code or duplication. Record every finding with its file path,
a severity (blocker, major, minor), and a concrete suggested fix.

### Step 3: Write the Review

Write `code-review-report.md` with a summary per unit, the counts of findings by
severity, and the blockers that must be fixed before deployment. Write each finding
as a row in `code-review-findings.md` so the approval gate can address it by ID.

### Step 4: Completion Handoff

Present the blockers and major findings to the person. They decide whether to
fix them now or accept them with a recorded reason. Do not fix code in this stage.

Hand completion to `stage-protocol.md` via
`{{INVOKE}} engine orchestrate report --stage code-review --result <outcome>`.
That `report` call owns every lifecycle transition and advancement; never perform one in prose, and never narrate this bookkeeping to the user.

Approval gate: strictly 2-option (Approve / Request Changes).

## Sensors

Required-sections check on `code-review-report.md`.

## Learn

When `directive.protocol_modules` lists `learnings`, follow
`stage-protocol-learnings.md`: keep the diary at `directive.memory_path` while
working, and take the learnings step before the approval gate; that module says
when it asks the person anything. When the module is absent, skip both the diary
and the step.

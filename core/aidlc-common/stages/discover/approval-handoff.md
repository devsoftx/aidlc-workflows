---
slug: approval-handoff
name: Approval & Handoff
phase: discover
execution: ALWAYS
condition: Always executes — compiles all Discover artifacts into initiative brief for approval
lead_agent: aidlc-delivery-agent
support_agents:
  - aidlc-product-agent
mode: inline
summary_confirmation: required
produces:
  - initiative-brief
  - decision-log
  - approval-handoff-questions
consumes:
  - artifact: intent-statement
    required: true
  - artifact: stakeholder-map
    required: true
  - artifact: scope-document
    required: true
  - artifact: intent-backlog
    required: true
  - artifact: competitive-analysis
    required: false
  - artifact: feasibility-assessment
    required: false
  - artifact: constraint-register
    required: false
  - artifact: team-assessment
    required: false
  - artifact: wireframes
    required: false
requires_stage:
  - intent-capture
  - feasibility
  - scope-definition
  - team-formation
  - rough-mockups
sensors:
  - required-sections
  - upstream-coverage
scopes:
  - enterprise
  - feature
inputs: All Discover phase artifacts (intent, market research, feasibility, scope, team, mockups)
outputs: initiative-brief.md, decision-log.md, approval-handoff-questions.md (under this stage's record dir, engine-resolved)
---

# Initiative Approval & Handoff

## Steps

### Step 1: Load Prior Context

Read ALL Discover phase artifacts:
- Intent statement and stakeholder map from `<record>/discover/intent-capture/`
- Market research from `<record>/discover/market-research/` (if exists)
- Feasibility assessment, constraint register, RAID log from `<record>/discover/feasibility/` (if exists)
- Scope definition and intent backlog from `<record>/discover/scope-definition/`
- Team formation artifacts from `<record>/discover/team-formation/` (if exists)
- Mockups/wireframes from `<record>/discover/rough-mockups/` (if exists)

### Step 2: Generate Approval Questions

Create `<record>/discover/approval-handoff/approval-handoff-questions.md` with questions:
- Do all stakeholders agree on the intent and scope?
- Have all critical risks been acknowledged with mitigations?
- Is there budget/resource commitment?
- Do the rough mockups reflect the shared vision?
- Does the market research support the investment?
- Are mobs staffed and scheduled?

Follow stage-protocol.md question flow.

### Step 3: Compile Initiative Brief

Create `<record>/discover/approval-handoff/initiative-brief.md` — a one-pager combining:
- Intent and problem statement
- Market validation summary
- Feasibility and risk highlights
- Scope boundary
- Concept visuals
- Team plan
- Go/no-go recommendation

Create `<record>/discover/approval-handoff/decision-log.md` — record of all decisions made during Discover.

### Step 4: Phase Boundary Verification

Run Discover → Design verification check:
- Intent → Scope → Intent Backlog consistency
- All scope items have feasibility backing
- Write results to `<record>/verification/phase-check-discover.md`

### Step 5: Completion Handoff

Hand completion to `stage-protocol.md` via
`{{INVOKE}} engine orchestrate report --stage approval-handoff --result <outcome>`.
That `report` call owns every lifecycle transition and advancement; never perform one in prose, and never narrate this bookkeeping to the user.

### Step 6: Present Completion & Request Approval

Completion emoji: :white_check_mark:
Review path: `<record>/discover/approval-handoff/`
Approval gate: Approve (Continue to `<directive.next_stage>`, the stage the engine names) / Request Changes.

## Sensors

This stage's outputs are markdown artefacts under `<record>/discover/approval-handoff/`.

Imports: `required-sections`, `upstream-coverage`.

Upstream targets: `intent-statement`, `stakeholder-map`, `scope-document`, `intent-backlog`, `competitive-analysis`, `feasibility-assessment`, `constraint-register`, `team-assessment`, `wireframes`.

## Learn

When `directive.protocol_modules` lists `learnings`, follow
`stage-protocol-learnings.md`: keep the diary at `directive.memory_path` while
working, and take the learnings step before the approval gate; that module says
when it asks the person anything. When the module is absent, skip both the diary
and the step.

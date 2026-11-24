# Discover Phase -- Stage Reference (1.1-1.8)

## Phase Overview

Discover is the first of the seven phases in the AI-DLC lifecycle. It runs
after the hidden setup in [Initialization](initialization.md) and establishes
the foundation for the initiative: it captures intent, researches the market,
checks feasibility, reverse-engineers an existing codebase, defines the scope,
forms the team, produces rough mockups, and compiles the initiative brief for
approval before any design work begins.

The phase has eight stages, numbered 1.1 through 1.8. Intent Capture (1.1),
Scope Definition (1.5) and Approval & Handoff (1.8) are ALWAYS stages; the other
five are CONDITIONAL. Each stage's condition is the rule in its stage file, and
the scope tables below show which stages each scope plans (`mvp`, for example,
does not plan Approval & Handoff).

Intent Capture (1.1) and Rough Mockups (1.7) name a reviewer, the Product Lead,
whose review is advisory: one pass whose findings the approval gate shows as
decision support.

Support agents take part only when collaborators are on (the `collaborators`
setting, shipped on only for `enterprise`; `/aidlc --collaborators on` turns it
on for one piece of work). With collaborators off, the engine hands each stage
an empty `support_agents` list and the lead runs alone.

## Stage Summary Table

| Stage | Name | Condition | Lead Agent | Support Agents | Mode |
|-------|------|-----------|------------|----------------|------|
| 1.1 | Intent Capture & Framing | ALWAYS | `aidlc-product-agent` | `aidlc-architect-agent` | inline |
| 1.2 | Market Research | CONDITIONAL | `aidlc-product-agent` | -- | inline |
| 1.3 | Feasibility & Constraints | CONDITIONAL | `aidlc-architect-agent` | `aidlc-aws-platform-agent`, `aidlc-compliance-agent` | inline |
| 1.4 | Reverse Engineering | CONDITIONAL | `aidlc-developer-agent` | `aidlc-architect-agent` | pipeline |
| 1.5 | Scope Definition | ALWAYS | `aidlc-product-agent` | `aidlc-delivery-agent` | inline |
| 1.6 | Team Formation | CONDITIONAL | `aidlc-delivery-agent` | -- | inline |
| 1.7 | Rough Mockups | CONDITIONAL | `aidlc-design-agent` | `aidlc-product-agent` | inline |
| 1.8 | Approval & Handoff | ALWAYS | `aidlc-delivery-agent` | `aidlc-product-agent` | inline |

## Scope Applicability

The compiled grid (`EXECUTE` in `scope-grid.json`) lists the Discover stages
each scope plans:

| Scope | Stages that run |
|-------|-----------------|
| bugfix | 1.4 |
| classic | 1.4 |
| enterprise | 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8 |
| express | 1.4 |
| feature | 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8 |
| infra | none |
| mvp | 1.1, 1.3, 1.4, 1.5, 1.7 |
| poc | 1.1, 1.4 |
| refactor | 1.4 |
| security-patch | 1.4 |
| workshop | 1.4 |

The compiled plan for a scope lists its stages in order. For mvp, the plan
starts in Discover and then continues into Design (output trimmed):

```text
$ aidlc engine graph scope mvp
workspace-scaffold
workspace-detection
state-init
intent-capture
feasibility
reverse-engineering
scope-definition
rough-mockups
practices-discovery
requirements-analysis
...
```

Discover ends at Approval & Handoff, or at the skip recorded when it does not
apply. Its output, the initiative brief, is the input to [Design](design.md).

---

## Stage 1.4: Reverse Engineering

### Metadata

| Field            | Value                                                                  |
|------------------|------------------------------------------------------------------------|
| Phase            | Discover                                                              |
| Stage #          | 1.4                                                                    |
| Condition        | CONDITIONAL -- brownfield; verified-current stores may be reused        |
| Lead Agent       | aidlc-developer-agent                                                        |
| Support Agents   | aidlc-architect-agent                                                        |
| Mode             | pipeline (2-link chain: aidlc-developer-agent scans, aidlc-architect-agent synthesizes and writes; the developer alone when collaborators are off) |
| Completion Emoji | (uses stage-protocol.md completion template)                           |

### Purpose

Reverse Engineering performs a comprehensive analysis of the existing codebase
for brownfield projects. It runs as a two-link pipeline (`mode: pipeline`):
first, the aidlc-developer-agent scans the entire codebase, leaving out AI-DLC's
own install; then, the aidlc-architect-agent synthesizes the scan results into 9
structured artifacts and writes them. These artifacts provide the technical
foundation that all subsequent stages build upon.

**Rerun guard:** Reverse Engineering checks each repository's recorded scope
and working-tree fingerprint before scanning. The fingerprint leaves out
AI-DLC's own install, settings, and the root files it writes into, so an AI-DLC
update or setting change does not make a store stale. The human may reuse a
verified-current store whose coverage fits the intent; stale, unverified,
legacy, or mismatched stores require a full or focused rescan. A store this
run of the stage already scanned and published (a new chat picking the stage
up) is not offered back: the stage goes on to its approval. Full rescans
replace the store; focused rescans merge newly analyzed areas into it while
preserving prior prose. For multi-repo intents, all decisions are resolved
before one stage-level lifecycle report.

### Inputs

- `<record>/aidlc-state.md` (project type confirmation)

### Steps

1. **Check Conditions** -- Read `<record>/aidlc-state.md` to confirm the
   project type is brownfield. If the project is not brownfield, skip this
   stage with `aidlc-orchestrate.ts report --stage reverse-engineering
   --result skipped --reason "greenfield workspace has no existing codebase to
   reverse engineer"`. The engine records `[S]` and routes onward atomically.

2. **Developer Code Scan** -- Delegate to Task tool with the aidlc-developer-agent
   subagent (`subagent_type="aidlc-developer-agent"`). The agent's persona and
   knowledge load automatically; the conductor does not inject the persona.
   Include workspace state from `aidlc-state.md` as context.

   The developer scans the entire codebase for:
   - All packages, modules, and their purposes
   - Build systems, configuration, and dependency relationships
   - External and internal APIs (endpoints, contracts, methods)
   - Frameworks, libraries, and their versions
   - Test directories, test frameworks, coverage configuration
   - Code quality indicators (linting, CI/CD, documentation)
   - Technical debt signals

   The developer writes its scan, following the Developer Code Scan Template in
   `{{HARNESS_DIR}}/knowledge/aidlc-developer-agent/re-artifacts.md`, to a
   durable handoff file: `<record>/discover/reverse-engineering/developer-scan.md`
   for the project-root repo, or `developer-scan-<repo>.md` for a registered
   repo. Its return names that path and any concerns, not the scan body.

3. **Architect Synthesis** -- Delegate to Task tool with the aidlc-architect-agent
   subagent (`subagent_type="aidlc-architect-agent"`); its persona and knowledge
   also load automatically. Pass the developer's handoff path (the architect
   reads the file) and the template path, plus workspace state from
   `aidlc-state.md`. Resolve the repository's output directory with
   `aidlc engine workspace codekb --repo <repo>`.
   Immediately before the scan, capture source/store generations with
   `codekb-snapshot`, and pass the existing store plus its snapshot to the
   architect. In a brownfield project with no store yet:

   ```text
   $ aidlc engine workspace codekb-snapshot --repo shop-api --paths ./ --json
   {"repo":"shop-api","store":"aidlc/spaces/default/codekb/shop-api/","paths":["./"],"store_generation":"none","source_fingerprint":"git:bc8ac8583f61da1edd5bdc681a9db722a937848b","head_commit":"0107291c4e5f2a8b9d3e6f1a7c8b2d4e5f6a7b8c"}
   ```

   The architect synthesizes scan results into the 9 output artifacts (see
   Outputs below) in a complete candidate directory,
   `<record>/.aidlc-engine/codekb-stage-<repo>/`. `codekb-publish` then swaps it
   into the store, with the snapshot's values passed back:

   ```text
   aidlc engine workspace codekb-publish --repo shop-api \
     --staged <record>/.aidlc-engine/codekb-stage-shop-api/ \
     --paths ./ --expect-store none \
     --expect-source git:bc8ac8583f61da1edd5bdc681a9db722a937848b --json
   ```

   It refuses with `CODEKB_STORE_CHANGED` when another intent published to
   the store after the snapshot (re-read the store, re-merge, take a fresh
   snapshot and retry). Under Guard Policy strict it also refuses with
   `CODEKB_SOURCE_CHANGED` when the code changed after the snapshot (scan
   again); under relaxed or off it publishes the scan as taken and returns a
   change notice.

4. **Prepare Completion** -- Verify all nine artifacts exist. Do not edit
   `aidlc-state.md`; lifecycle completion belongs to the report after the gate.

5. **Present Completion & Request Approval** -- Open the gate with
   `aidlc-orchestrate.ts report --stage reverse-engineering --result
   awaiting-approval`, display all nine artifacts, then report the human's
   approved/rejected outcome through the same engine command.

### Outputs

All 9 artifacts for each repository are written to
`aidlc/spaces/<active-space>/codekb/<repo>/`, using the exact directory printed
by `aidlc engine workspace codekb --repo <repo>`:

| #  | File                             | Contents                                                    |
|----|----------------------------------|-------------------------------------------------------------|
| 1  | `business-overview.md`           | Business domain, purpose, key functionality                 |
| 2  | `architecture.md`                | System architecture, patterns, component relationships (with Mermaid diagrams). MUST include Interaction Diagrams section depicting how business transactions are implemented across components (sequence or flow diagrams). |
| 3  | `code-structure.md`              | Package/module organization, file classification, code patterns |
| 4  | `api-documentation.md`           | External and internal API surfaces, endpoints, contracts    |
| 5  | `component-inventory.md`         | Complete component list with responsibilities and dependencies |
| 6  | `technology-stack.md`            | Languages, frameworks, libraries with versions              |
| 7  | `dependencies.md`                | External dependencies, internal cross-package dependencies  |
| 8  | `code-quality-assessment.md`     | Test coverage, linting, CI/CD, documentation quality, tech debt |
| 9  | `reverse-engineering-timestamp.md` | When RE was performed (date, commit hash if available, scope of analysis) |

### Approval Gate

Standard 2-option gate: **Approve** / **Request Changes**.

### Notes

- **Rerun guard:** This stage verifies each brownfield repository's recorded
  scope and fingerprint before the human chooses reuse or rescan.
- **Two-link pipeline:** The aidlc-developer-agent performs the raw code
  scan (link 1, the lead), then the aidlc-architect-agent synthesizes the scan
  into structured artifacts and writes them (link 2, the final link). This separation ensures the scan is thorough (developer
  perspective) and the synthesis is architecturally informed (architect
  perspective).
- In bugfix, refactor and security-patch it runs on brownfield work, to
  understand the code being fixed or changed; on greenfield work creation sets
  it to SKIP, as in every scope.
- The 9 artifacts produced here are consumed by Requirements Analysis (2.2),
  User Stories (2.3), Domain Design (2.5), and Units Generation (2.6).
- The `architecture.md` artifact must include Interaction Diagrams showing how
  business transactions are implemented across components, using sequence or
  flow diagrams.


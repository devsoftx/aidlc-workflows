# Design Phase -- Stage Reference (2.1-2.12)

## Phase Overview

Design is the second of the seven phases in the AI-DLC lifecycle. It takes the
initiative brief approved in [Discover](discover.md) and turns it into the
practices, requirements, user stories, mockups, domain model, units, contracts
and delivery plan, then the functional, non-functional and infrastructure
designs that Build works from.

The phase has twelve stages, numbered 2.1 through 2.12. Requirements Analysis
(2.2), Units Generation (2.6) and Delivery Planning (2.8) are ALWAYS stages; the
other nine are CONDITIONAL. Delivery Planning is the phase's capstone: it
produces the detailed execution plan for Build through Operate.

Reviews: the Product Lead reviews Requirements Analysis, User Stories and
Refined Mockups, and the Architecture Reviewer reviews Domain Design, Units
Generation, Contract Design, Functional Design, NFR Requirements, NFR Design and
Infrastructure Design. Requirements Analysis, User Stories, Refined Mockups,
Domain Design, Units Generation and Contract Design are advisory: one pass whose
findings the approval gate shows. The other four are adversarial, the default,
so the builder revises on NOT-READY up to the review cap.

Support agents take part only when collaborators are on (the `collaborators`
setting, shipped on only for `enterprise`; `/aidlc --collaborators on` turns it
on for one piece of work). With collaborators off, the engine hands each stage
an empty `support_agents` list and the lead runs alone.

## Stage Summary Table

| Stage | Name | Condition | Lead Agent | Support Agents | Mode |
|-------|------|-----------|------------|----------------|------|
| 2.1 | Practices Discovery | CONDITIONAL | `aidlc-pipeline-deploy-agent` | `aidlc-quality-agent`, `aidlc-developer-agent`, `aidlc-devsecops-agent` | subagent |
| 2.2 | Requirements Analysis | ALWAYS | `aidlc-product-agent` | -- | inline |
| 2.3 | User Stories | CONDITIONAL | `aidlc-product-agent` | `aidlc-design-agent`, `aidlc-developer-agent`, `aidlc-quality-agent` | mob |
| 2.4 | Refined Mockups | CONDITIONAL | `aidlc-design-agent` | `aidlc-product-agent` | inline |
| 2.5 | Domain Design | CONDITIONAL | `aidlc-architect-agent` | `aidlc-aws-platform-agent`, `aidlc-design-agent` | inline |
| 2.6 | Units Generation | ALWAYS | `aidlc-architect-agent` | `aidlc-delivery-agent` | inline |
| 2.7 | Contract Design | CONDITIONAL | `aidlc-architect-agent` | `aidlc-aws-platform-agent` | inline |
| 2.8 | Delivery Planning | ALWAYS | `aidlc-delivery-agent` | `aidlc-architect-agent` | inline |
| 2.9 | Functional Design | CONDITIONAL | `aidlc-architect-agent` | `aidlc-developer-agent` | inline |
| 2.10 | NFR Requirements | CONDITIONAL | `aidlc-architect-agent` | `aidlc-devsecops-agent`, `aidlc-compliance-agent`, `aidlc-quality-agent` | inline |
| 2.11 | NFR Design | CONDITIONAL | `aidlc-architect-agent` | `aidlc-aws-platform-agent` | inline |
| 2.12 | Infrastructure Design | CONDITIONAL | `aidlc-aws-platform-agent` | `aidlc-devsecops-agent`, `aidlc-compliance-agent` | inline |

## Scope Applicability

The compiled grid (`EXECUTE` in `scope-grid.json`) lists the Design stages each
scope plans:

| Scope | Stages that run |
|-------|-----------------|
| bugfix | 2.2 |
| classic | 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10, 2.11, 2.12 |
| enterprise | 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10, 2.11, 2.12 |
| express | 2.2 |
| feature | 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10, 2.11, 2.12 |
| infra | 2.1, 2.2, 2.10, 2.11, 2.12 |
| mvp | 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10, 2.11, 2.12 |
| poc | 2.2 |
| refactor | 2.2, 2.9 |
| security-patch | 2.2, 2.10 |
| workshop | 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10, 2.11, 2.12 |

Code Generation (stage 3.1, Build) takes each unit of work from Units Generation
and the design artifacts from Functional Design, NFR Design and Infrastructure
Design. The bolt plan that Delivery Planning produces sets the order of the
units.

---

## Stage 2.1: Practices Discovery

### Metadata

| Field            | Value                                                                  |
|------------------|------------------------------------------------------------------------|
| Phase            | Design                                                              |
| Stage #          | 2.1                                                                    |
| Condition        | CONDITIONAL -- always rerun for freshness on EXECUTE scopes            |
| Lead Agent       | aidlc-pipeline-deploy-agent                                                  |
| Support Agents   | aidlc-quality-agent, aidlc-developer-agent, aidlc-devsecops-agent                        |
| Mode             | subagent (lead draft → three mutually blind spokes → human interview → lead integration; no spokes when collaborators are off) |
| Completion Emoji | (uses stage-protocol.md completion template)                           |

### Purpose

Practices Discovery is the only stage in AI-DLC that writes to both rows of
the two-axis configuration model. It discovers a team's way of working,
walking-skeleton stance, testing posture, deployment cadence, and code-style
rules. Brownfield runs use repository and Reverse Engineering evidence;
greenfield runs seed the lead draft from active-space `org.md`. Both use the
same subagent hub-and-spoke: pipeline-deploy lead draft, mutually blind
quality/developer/devsecops contributions, human interview, then lead
integration. After the human approves at the affirmation gate, the content is
promoted into `aidlc/spaces/<active-space>/memory/team.md` and `project.md`
before the stage reports approval.

### Inputs

- `<record>/aidlc-state.md` (project type)
- Brownfield only: reverse-engineering's 9 artifacts from
  `aidlc/spaces/<active-space>/codekb/<repo>/` (business-overview,
  architecture, code-structure, api-documentation, component-inventory,
  technology-stack, dependencies, code-quality-assessment,
  reverse-engineering-timestamp)
- `aidlc/spaces/<active-space>/memory/{org,team,project}.md` (defaults and prior affirmations)
- `.claude/knowledge/aidlc-pipeline-deploy-agent/branching-strategies.md` (lead-agent KB)

### Outputs

Four lead artifacts plus three spoke contributions are written to
`<record>/design/practices-discovery/`:

- `team-practices.md` -- descriptive, team-voice prose. Five sections matching
  `team.md` headings: Way of Working, Walking Skeleton, Testing Posture,
  Deployment, Code Style. Testing Posture carries structured
  `Methodology: tdd|bdd|atdd|test-after|custom` and `Ordering: ...` bullets;
  coverage/tooling/scope notes remain additional prose. The Methodology value
  is one of those five and nothing else, with its reasons in a separate
  `Methodology evidence:` bullet: the gate does not open on a value Code
  Generation could not read, and `practices-promote` splits a value given with
  its reasons ("test-after (because ...)") into the bare value and that bullet
  before it writes `team.md`. Reasons that name a second methodology describe a
  mix, which is `custom`, so that value is never split.
- `discovered-rules.md` -- corrective, agent-facing. Two sections: Mandated
  (`ALWAYS …` rules) and Forbidden (`NEVER …` rules).
  Each rule is one list item, and only those list items are rules
  (`practicesRulesToAdd` in `aidlc-state.ts`): the gate's line names the ones
  Approve adds to `project.md`, and `practices-promote` writes exactly those.
- `evidence.md` -- per-agent finding summary; freshness trail for re-runs.
- `practices-discovery-timestamp.md` -- run timestamp + commit hash.
- `contributions/aidlc-{quality,developer,devsecops}-agent.md` -- one
  identity-marked contribution from each mutually blind spoke (none when
  collaborators are off); these files are
  engine-checked completion evidence.

On affirmation, content is promoted to:

- `aidlc/spaces/<active-space>/memory/team.md` -- section-replace via `replaceSection` (re-runs
  overwrite section content rather than accumulate).
- `aidlc/spaces/<active-space>/memory/project.md` -- append-under-heading
  via `appendUnderHeading` (rules accumulate; date stamps distinguish them).

A heading either file lacks is added at its end first (`ensureHeading`), so the
save also works in a space made by `space create`, whose `team.md` and
`project.md` start as one line, and in a file a team trimmed by hand.

### Steps

1. **Classify Inputs** -- Read `aidlc-state.md` to classify greenfield vs
   brownfield and resolve the active space. Brownfield loads Reverse
   Engineering artifacts and repository evidence. Greenfield loads defaults
   from `memory/org.md`. A re-run also loads prior `team.md` and `project.md`.
2. **Lead Draft** -- Dispatch `aidlc-pipeline-deploy-agent`. It writes the
   initial `team-practices.md`, `discovered-rules.md`, and `evidence.md`.
   Brownfield drafts from observed evidence; greenfield drafts from org
   defaults and clearly marks every unconfirmed assumption.
3. **Three Mutually Blind Spokes** -- In one parallel batch, dispatch
   `aidlc-quality-agent`, `aidlc-developer-agent`, and
   `aidlc-devsecops-agent` against the lead draft. Briefs contain the draft
   paths but no other spoke's output. Each writes its own identity-marked
   contribution file under `contributions/`; it does not edit the lead's
   artifacts.
4. **Human Interview** -- Present structured questions after all three spokes
   return. Brownfield asks evidence gaps and policy judgments; greenfield asks
   all five practice areas with org defaults as suggestions. Re-runs pre-fill
   prior affirmed statements. Log every question and exact answer.
5. **Lead Integration** -- Dispatch the pipeline-deploy lead again with the
   draft, all three contribution paths, and the interview answers. The lead
   alone integrates the final artifacts and emits `PRACTICES_DISCOVERED`.
   Mixed cadences use `Methodology: custom` so Code Generation preserves the
   explicit ordering rather than coercing the answer into TDD.
6. **Open the Affirmation Gate** -- Call `aidlc-orchestrate.ts report --stage
   practices-discovery --result awaiting-approval` before asking. Present the
   drafts with exactly two options: **Approve** / **Request Changes**. A
   Request Changes response is reported through `--result rejected`; no
   promotion occurs.
7. **Promote After Human Approval** -- Only after the human chooses Approve,
   run the deterministic promotion into active-space `team.md` and
   `project.md`:

   ```text
   aidlc engine state practices-promote \
     --team-practices <record>/design/practices-discovery/team-practices.md \
     --discovered-rules <record>/design/practices-discovery/discovered-rules.md \
     --affirming-user '<user>'
   ```

   It writes `project.md` first and `team.md` second and emits
   `PRACTICES_AFFIRMED`. If promotion fails, it emits `PRACTICES_OVERRIDE`,
   leaves the stage `[?]` with the gate open, and does not report approval.
8. **Verify Receipt, Then Report** -- Successful promotion atomically records
   `Practices Affirmed Timestamp` and the matching `PRACTICES_AFFIRMED` audit
   receipt. Then call
   `aidlc-orchestrate.ts report --stage practices-discovery --result
   approved --user-input "Approve"`. The engine verifies all three
   contribution files (none when collaborators are off) and the current-attempt receipt before completing and
   routing.

### Approval Gate

Standard 2-option gate: **Approve** / **Request Changes**. Approve is held
open while promotion runs; only after promotion and the affirmed timestamp
succeed may the conductor report
`--result approved --user-input "Approve"`. Promotion failure leaves the
gate open and the stage incomplete.

### Notes

- The promotion replaces each `team.md` section's body and keeps its heading
  (`replaceSection` in `.claude/tools/aidlc-markdown.ts`), so a re-run does not
  pile up duplicates the way `appendUnderHeading` would.
- `org.md` and `team.md` share one Title Case heading set
  (`## Way of Working`, `## Walking Skeleton`, `## Testing Posture`,
  `## Deployment`, `## Code Style`). The stage reads each section from
  `org.md` via `extractMarkdownSection` with the matching Title Case
  heading and section-replaces the same heading in `team.md`.
- Code Generation's deterministic posture resolver reads the structured
  Testing Posture fields independently from coverage, tooling, and scope notes.
  A project-only coverage note therefore specializes the team section without
  erasing its methodology.
- On resume, keep the lead draft and every existing contribution file.
  Dispatch only missing spokes, then continue with the interview and lead
  integration. Do not repeat completed support work.
- Contribution evidence is mandatory. Approval is refused if any quality,
  developer, or devsecops contribution is missing or has the wrong identity
  marker.


---

## Stage 2.2: Requirements Analysis

### Metadata

| Field            | Value                                                                  |
|------------------|------------------------------------------------------------------------|
| Phase            | Design                                                              |
| Stage #          | 2.2                                                                    |
| Condition        | ALWAYS -- depth adapts to complexity                                   |
| Lead Agent       | aidlc-product-agent                                                          |
| Support Agents   | (none)                                                                 |
| Mode             | inline                                                                 |
| Completion Emoji | :mag:                                                                  |

### Purpose

Requirements Analysis transforms the user's intent and any reverse-engineered
codebase understanding into formal, structured requirements. It assesses the
request for clarity, type, scope, and complexity; determines the appropriate
depth; extracts what is already known; runs a completeness analysis across six
dimensions; generates clarifying questions; and produces a formal requirements
document.

This stage always executes but adapts its depth based on project complexity:
minimal for clear/narrow scope, standard for moderate scope, comprehensive for
large scope with significant unknowns.

### Inputs

- Reverse Engineering artifacts from Stage 1.4
  (`aidlc/spaces/<active-space>/codekb/<repo>/`), if brownfield
- The authoritative project description from the `project-description`
  utility (never rebuilt from an audit `Request`)
- Intent statement and scope document from Discover, and team practices from
  Practices Discovery, when those stages ran

### Steps

1. **Load Prior Context** -- If brownfield: read RE artifacts from
   `aidlc/spaces/<active-space>/codekb/<repo>/`. Read the project description
   with `project-description`.

2. **Analyze User Request** -- Assess the request for:
   - **Clarity**: How well-defined is the request?
   - **Type**: New feature, enhancement, refactoring, bug fix, migration
   - **Scope**: Single component, multi-component, system-wide
   - **Complexity**: Simple, standard, complex

3. **Determine Depth**

4. **Assess Current Requirements** -- Extract and organize what is already
   known from the user's input: explicit functional requirements, implied
   non-functional requirements, constraints and assumptions, business context
   and goals.

5. **Completeness Analysis** -- Evaluate coverage across six dimensions:
   1. Functional requirements -- core behaviors, features, use cases
   2. Non-functional requirements -- performance, security, scalability,
      reliability, observability
   3. User scenarios -- user workflows, edge cases, error scenarios
   4. Business context -- goals, success metrics, stakeholders, constraints
   5. Technical context -- integration points, platform requirements,
      technology constraints
   6. Quality attributes -- maintainability, testability, accessibility,
      usability

   Identify gaps in each dimension. At Standard and Comprehensive depth, the
   User scenarios dimension is swept with the product agent's
   `corner-checklist.md`: each component the request names is crossed with
   the edge conditions it touches (empty, missing, partial failure, two copies
   of one fact, and so on), and every condition that applies lands in
   `requirements.md` as a requirement, an assumption with its reason, or an
   out-of-scope item. A corner becomes a question only when it depends on a
   fact about the user's world the agent cannot know. Minimal depth does not
   load the checklist.

6. **Generate Clarifying Questions** -- PROACTIVE: always generate clarifying
   questions unless requirements are exceptionally clear and complete across
   all six dimensions. Create
   `<record>/design/requirements-analysis/requirements-analysis-questions.md`
   using the `[Answer]:` tag format. Include context-appropriate questions with
   A-E options (A-D on Claude Code, A-C on Codex). Every ordinary clarifying question must end with `X. Other (please specify)` as
   the final option. All `[Answer]:` tags left blank.

7. **Collect and Analyze Answers** -- Read the questions file, confirm all
   `[Answer]:` tags are filled. If any are blank, present unanswered questions
   via AskUserQuestion and write answers back. Do NOT proceed with partial
   answers. Run:
   - MANDATORY ambiguity detection: scan all responses for vague language
     ("mix of", "not sure", "depends")
   - Contradiction check between answers
   - Missing detail identification

8. **Follow-Up Questions** -- If ANY ambiguity, vagueness, or contradictions
   found, create follow-up questions targeting the specific issues. Resolve
   all ambiguities before proceeding.

9. **Generate Requirements** -- Create
    `<record>/design/requirements-analysis/requirements.md` containing:
    - Intent analysis -- what the user is trying to achieve (goals, not just
      features)
    - Functional requirements -- organized by feature area or domain. Give
      every requirement a stable `FR{n}` ID (for example `FR1`) and every
      sub-requirement an `FR{n}.{m}` ID (for example `FR1.2`)
    - Non-functional requirements -- performance, security, scalability,
      reliability, and observability targets, each with a stable `NFR{n}` ID
    - Constraints -- technical, business, organizational
    - Assumptions -- documented with rationale
    - Out of scope -- explicitly excluded items
    - Open questions -- remaining uncertainties for later stages

10. **Prepare Completion** -- Verify the requirements artifacts. Do not edit
    `<record>/aidlc-state.md`; the engine owns completion and routing.

11. **Present Completion & Request Approval** -- Display completion message
    with :mag: emoji and review path. The approval gate has two variants:

    **If User Stories is set to SKIP in the execution state:** 3-option gate:
    Approve / Request Changes / Approve, and add User Stories next (include the
    currently skipped User Stories stage and start it). On that pick, run
    `aidlc engine orchestrate next --add user-stories` and follow its step, which
    names the report that records the approval; do not edit the checkbox directly.
    A request to add User Stories with no approval in it is the same
    `next --add`, with the gate asked once more.

    **If User Stories is NOT set to SKIP:** Standard 2-option gate: Approve /
    Request Changes.

### Outputs

All artifacts written to `<record>/design/requirements-analysis/`:

| File                                 | Contents                                                |
|--------------------------------------|---------------------------------------------------------|
| `requirements.md`                    | Formal requirements: intent analysis, functional/non-functional requirements, constraints, assumptions, out-of-scope, open questions |
| `requirements-analysis-questions.md` | Clarifying questions with `[Answer]:` tags (input artifact) |
| `traceability.json`                  | The FR and NFR IDs `requirements.md` defines, spelled as it spells them, each with its `kind` and, for a sub-requirement, the requirement it belongs to (`of`); later stages trace from this list |

### Approval Gate

Conditional gate format:

- **If User Stories is skipped:** 3-option gate -- **Approve** / **Request
  Changes** / **Approve, and add User Stories next**
- **If User Stories is not skipped:** Standard 2-option gate -- **Approve** /
  **Request Changes**

### Notes

- This is the most detailed question-and-answer stage in the workflow. It
  enforces mandatory ambiguity detection and will not proceed with partial or
  vague answers.
- Depth scales with complexity: minimal for bugfix/poc, standard for feature,
  comprehensive for enterprise.
- For bugfix scope, this stage captures the bug description at minimal depth.
- For infra scope, this stage captures infrastructure requirements.
- The requirements document produced here is consumed by User Stories (2.3),
  Refined Mockups (2.4), Domain Design (2.5), Units Generation (2.6),
  Contract Design (2.7), and Delivery Planning (2.8).


---

## Stage 2.3: User Stories

### Metadata

| Field            | Value                                                                  |
|------------------|------------------------------------------------------------------------|
| Phase            | Design                                                              |
| Stage #          | 2.3                                                                    |
| Condition        | CONDITIONAL -- execute for user-facing features, multiple personas, complex business logic, or cross-team work |
| Lead Agent       | aidlc-product-agent                                                          |
| Support Agents   | aidlc-design-agent, aidlc-developer-agent, aidlc-quality-agent               |
| Mode             | mob (lead only when collaborators are off)                             |
| Completion Emoji | :books:                                                                |

### Purpose

User Stories translates formal requirements into user-centered stories that
define the "who, what, and why" of each feature. The stage follows a two-part
structure: PART 1 creates a story plan with clarifying questions, and PART 2
generates the actual stories and personas. The plan and stories are presented
together at the completion gate for combined review.

This stage is the mob-elaboration showcase (mode: mob): the Product Manager
leads, and the design, developer, and quality agents are dispatched as
independent collaborators against the lead's draft - blind round, integrate,
one bounded objection round - with the Product Leader reviewing afterwards.
The aidlc-design-agent's user-experience perspective is a deliberate addition
not in the upstream reference.

### Inputs

- `<record>/design/requirements-analysis/requirements.md`
- RE artifacts from Stage 1.4
  (`aidlc/spaces/<active-space>/codekb/<repo>/`),
  if brownfield

### Steps

1. **Load the Lead Persona** -- The step carries the aidlc-product-agent
   persona (`lead_persona`); read its knowledge from
   `.claude/knowledge/aidlc-product-agent/`. The support agents (design,
   developer, quality) are NOT loaded inline - this is a mob stage; they are
   dispatched as independent collaborators during generation.

2. **Validate User Stories Are Needed** -- Assess whether user stories add
   value for this project:
   - **Execute if**: user-facing features, multiple user personas, complex
     business logic, cross-team coordination needed
   - **Skip if**: pure refactoring, isolated bug fixes, infrastructure-only,
     developer tooling

   Create `<record>/design/user-stories/user-stories-assessment.md`
   documenting: decision (Execute or Skip), rationale, factors considered,
   key value areas (if executing) or alternative coverage (if skipping).

   If skipping, call `aidlc-orchestrate.ts report --stage user-stories
   --result skipped --reason '<reason from the assessment>'`. The engine
   records `[S]` and routes before artifact or ensemble-evidence checks.

3. **Load Prior Context** -- Read
   `<record>/design/requirements-analysis/requirements.md`. If brownfield,
   read relevant RE artifacts from
   `aidlc/spaces/<active-space>/codekb/<repo>/`.

**PART 1: Planning**

4. **Create Story Plan with Questions** -- Create
   `<record>/design/user-stories/user-stories-questions.md` containing:
   - Persona development approach (who are the users, what are their goals)
   - Story format using INVEST criteria (Independent, Negotiable, Valuable,
     Estimable, Small, Testable)
   - Story prioritization using MoSCoW priority (Must Have / Should Have /
     Could Have / Won't Have). The MVP boundary is formally decided during
     Delivery Planning; story priorities inform that decision.
   - Breakdown approach options (by feature, persona, workflow, domain area,
     or epic)
   - Embedded questions using `[Answer]:` tag format for user input on
     personas and story granularity

5. **Collect Answers** -- Collect answers following stage-protocol.md section 3
   question flow (collect answers, write back to
   file).

6. **Analyze Answers** -- MANDATORY ambiguity analysis: scan all responses for
   vague language ("mix of", "not sure", "depends"). Check for
   contradictions. Identify missing details. Create follow-up questions if ANY
   ambiguity found.

7. **Present Plan and Generate** -- Present the story plan summary (persona
   count, story count, breakdown approach) inline. Then immediately proceed to
   PART 2. The user reviews and approves the combined output (plan + generated
   stories) at the completion gate.

   If the user interjects with feedback before generation completes, treat it
   as a revision request and update the plan before continuing generation.

**PART 2: Generation**

8. **Execute Plan -- Generate Stories and Personas via the Mob**:

   **Lead draft.** The aidlc-product-agent first drafts
   `<record>/design/user-stories/personas.md`:
   - User persona definitions (name, role, goals, pain points, context)
   - Persona relationships and priority ranking

   and `<record>/design/user-stories/stories.md`:
   - User stories in standard format: "As a [persona], I want [goal], so that
     [benefit]"
   - Acceptance criteria for each story
   - Story priority (Must Have / Should Have / Could Have / Won't Have)
   - Story dependencies and relationships
   - INVEST compliance notes

   **Mutually blind support contributions.** Dispatch aidlc-design-agent,
   aidlc-developer-agent, and aidlc-quality-agent in one parallel round against
   the lead draft. Each brief contains the draft, Q&A, and requirements paths,
   but no sibling contribution. Each support agent writes its identity-marked
   file under
   `<record>/design/user-stories/contributions/<agent-slug>.md`.

   **Lead integration.** The aidlc-product-agent integrates all three
   contributions into `personas.md` and `stories.md` before the completion
   gate. Judgment calls go to the human mid-stage; knowledge disputes get one
   bounded objection round. Maintained dissent is quoted at the gate.

9. **Prepare Completion** -- Verify the mob artifacts and all three
   collaborator contribution files. Do not edit state; report the gate outcome
   through `aidlc-orchestrate.ts`.

10. **Present Completion & Request Approval** -- Display completion message
    with :books: emoji, summary of personas and stories produced, and review
    path. Standard 2-option approval gate: Approve (continue to next stage) /
    Request Changes.

### Outputs

All artifacts written to `<record>/design/user-stories/`:

| File                           | Contents                                                     |
|--------------------------------|--------------------------------------------------------------|
| `stories.md`                   | User stories with acceptance criteria, priority, dependencies, INVEST notes |
| `personas.md`                  | User persona definitions, relationships, priority ranking    |
| `user-stories-assessment.md`   | Execute/skip decision with rationale and factors considered   |
| `traceability.json`            | Every `FR` and `NFR` ID from `requirements.md` (a requirement with sub-requirements through its `FR{n}.{m}` IDs) mapped to stories (`OK`), or marked `Deferred` with a named downstream stage or `N/A` with a justification; checked by the `traceability` sensor |
| `user-stories-questions.md`    | Story plan with clarifying questions using `[Answer]:` tags (input artifact) |
| `contributions/aidlc-{design,developer,quality}-agent.md` | Mutually blind support contributions integrated by the lead before the gate |

### Approval Gate

Standard 2-option gate: **Approve** (continue to next stage) / **Request
Changes**.

### Notes

- Skip conditions: pure refactoring, isolated bug fixes, infrastructure-only,
  developer tooling.
- The two-part structure (plan then generate) allows the user to influence the
  story decomposition approach before stories are written.
- User story priorities (MoSCoW) inform but do not determine the MVP boundary.
  The formal MVP boundary is set during Delivery Planning (Stage 2.8).
- The `user-stories-assessment.md` artifact is always produced, even when the
  stage is skipped, to document the rationale.
- With collaborators on, the three identity-marked contribution files are
  mandatory ensemble evidence; approval is refused until the lead has
  integrated all three. A lead-only run owes none.
- Stories produced here are consumed by Refined Mockups (2.4), Domain
  Design (2.5), Units Generation (2.6), Delivery Planning (2.8), and
  Functional Design (2.9), which traces each Unit's acceptance criteria.
- The aidlc-design-agent support adds a UX view to the stories.


---

## Stage 2.4: Refined Mockups

### Metadata

| Field            | Value                                                                  |
|------------------|------------------------------------------------------------------------|
| Phase            | Design                                                              |
| Stage #          | 2.4                                                                    |
| Condition        | CONDITIONAL -- execute when user-facing UI exists; for APIs, refine interaction diagrams |
| Lead Agent       | aidlc-design-agent                                                           |
| Support Agents   | aidlc-product-agent (validates against stories)                              |
| Mode             | inline                                                                 |
| Completion Emoji | :art:                                                                  |

### Purpose

Refined Mockups evolves the rough concept wireframes from Rough Mockups (1.7)
into mid-to-high fidelity mockups informed by formal requirements and user
stories. It produces detailed interaction specifications, design system
mappings, responsive behavior definitions, and accessibility compliance
checklists.

For non-UI initiatives (API-only, backend), the stage refines interaction
diagrams into an API developer experience specification.

When Stage 1.7 (Rough Mockups) did not run, as in classic and workshop, it
designs the refined mockups from the stories and requirements.

### Inputs

- Rough mockups from Stage 1.7 (`<record>/discover/rough-mockups/`), if
  exists
- User stories from Stage 2.3 (`<record>/design/user-stories/`)
- Requirements from Stage 2.2
  (`<record>/design/requirements-analysis/`)

### Steps

1. **Load Prior Context** -- Read rough mockups from
   `<record>/discover/rough-mockups/` (if exists). Read user stories from
   `<record>/design/user-stories/`. Read requirements from
   `<record>/design/requirements-analysis/`.

2. **Generate Clarifying Questions** -- Create
   `<record>/design/refined-mockups/refined-mockups-questions.md` with
   questions covering:
   - How each user story should be represented in the UI
   - Interaction patterns needed (modals, inline edits, wizards, progressive
     disclosure)
   - States each screen must handle (loading, empty, error, success, partial)
   - Alignment with existing design system / component library
   - Accessibility requirements (WCAG level)
   - Responsive breakpoints needed
   - For APIs: developer experience requirements

   Follows stage-protocol.md question flow.

3. **Collect and Analyze Answers** -- Validate design decisions against user
   stories and requirements for consistency.

4. **Generate Artifacts** -- Create mid-to-high fidelity mockups (per user
   story/screen), interaction specification document, design system mapping,
   responsive behavior specification, and accessibility compliance checklist.
   For non-UI initiatives, create API developer experience specification.

5. **Prepare Completion** -- Verify the refined-mockup artifacts. Do not edit
   state; report the gate outcome through `aidlc-orchestrate.ts`.

6. **Present Completion & Request Approval** -- Display completion message
   with :art: emoji. Standard approval gate (Approve / Request Changes).

### Outputs

All artifacts written to `<record>/design/refined-mockups/`:

| File                            | Contents                                                    |
|---------------------------------|-------------------------------------------------------------|
| `mockups.md`                    | Mid-to-high fidelity mockups per user story/screen          |
| `interaction-spec.md`           | Interaction patterns, state management, transitions          |
| `design-system-mapping.md`      | Component mapping to design system / component library       |
| `accessibility-checklist.md`    | WCAG compliance checklist and requirements                   |
| `refined-mockups-questions.md`  | Clarifying questions with `[Answer]:` tags (input artifact)  |

### Approval Gate

Standard 2-option gate: **Approve** / **Request Changes**.

### Notes

- Runs for user-facing UI; for an API it refines interaction diagrams into an
  API developer experience specification. When Rough Mockups did not run
  (classic, workshop), it designs from the stories and requirements instead.
- For mvp scope, this stage executes only if the project has UI.
- The mockups produced here feed into Domain Design (2.5) and ultimately
  into Code Generation (3.1) for UI components.
- The accessibility checklist provides testable criteria that feed into Build
  and Test (4.1).


---

## Stage 2.5: Domain Design

### Metadata

| Field            | Value                                                                  |
|------------------|------------------------------------------------------------------------|
| Phase            | Design                                                              |
| Stage #          | 2.5                                                                    |
| Condition        | CONDITIONAL -- execute when new components or services are needed; skip for modifications to existing components only |
| Lead Agent       | aidlc-architect-agent                                                        |
| Support Agents   | aidlc-aws-platform-agent, aidlc-design-agent                                |
| Mode             | inline                                                                 |
| Completion Emoji | :building_construction:                                                |

### Purpose

Domain Design identifies the **logical building blocks** of the system — the
components you write code for. A component is a bounded piece of software with
its own business logic, entities, and lifecycle (code you write, not
infrastructure you deploy). This stage captures each component's behaviour,
its dependencies and dependents, and the entities it owns, plus the rationale
for each boundary. It does NOT decide deployment topology (that is Units
Generation) or tech stack / NFR patterns (later stages).

The aidlc-aws-platform-agent provides supporting perspective on managed-service
dependencies; the aidlc-design-agent contributes UI component structure.

### Inputs

- `<record>/design/requirements-analysis/requirements.md`
- `<record>/design/user-stories/stories.md` (if produced)
- RE artifacts from Stage 1.4 (especially `architecture.md`,
  `component-inventory.md`, `dependencies.md`), if brownfield

### Steps

1. **Load Prior Context** -- Read requirements, user stories (if produced),
   and RE artifacts (if brownfield, especially architecture.md,
   component-inventory.md, dependencies.md). Scope context comes from
   `<record>/aidlc-state.md`.

2. **Create Design Plan with Questions** -- Create
   `<record>/design/domain-design/domain-design-questions.md`
   with context-appropriate questions using `[Answer]:` tag format covering:
   - Component boundary decisions
   - Architectural style preferences (if not already decided)
   - Service communication patterns (sync vs. async, REST vs. gRPC vs.
     events)
   - Data ownership and storage strategy
   - Integration approach with existing components (brownfield)
   - UI component structure (if user-facing, informed by UX designer
     perspective)

3. **Collect and Analyze Answers** -- Collect answers following
   stage-protocol.md section 3 question flow. MANDATORY ambiguity analysis:
   scan for vague language, contradictions, missing details. Create follow-up
   questions if ANY ambiguity found. Resolve all ambiguities before proceeding.

4. **Generate the Component Catalogue** -- Create the single consolidated
   `components.md` (see Outputs below): a fenced `yaml` catalogue (source of
   truth) plus the derived human view (mermaid diagram + summary/ownership/
   rationale tables).

5. **Prepare Completion** -- Verify the design artifacts. Do not edit state;
   report the gate outcome through `aidlc-orchestrate.ts`.

6. **Present Completion & Request Approval** -- Display completion message
   with :building_construction: emoji, summary of design artifacts, key
   architectural decisions highlighted, and review path. 3-option approval
   gate: Approve / Request Changes / Approve, and add Units Generation next (if
   it was skipped in execution plan). That pick runs
   `aidlc engine orchestrate next --add units-generation` and its step, which
   names the report that records the approval; it never edits the state checkbox
   directly.

### Outputs

The artifacts written to `<record>/design/domain-design/`:

| File                              | Contents                                                  |
|-----------------------------------|-----------------------------------------------------------|
| `components.md`                   | Fenced `yaml` component catalogue (source of truth): each component's `behaviour`, `responsibilities`, `depends_on`/`dependents`, `external_dependencies`, and owned `entities` (with `identifier`, attributes, and cross-component `references`). Followed by the derived human view: mermaid Component Diagram, Component Summary, Entity Ownership, External Dependencies, and Rationale tables |
| `decisions.md`                    | The ADR log — architecture decision records capturing key design decisions and their rationale |
| `traceability.json`               | Coverage table mapping each upstream `USx.y` (or fallback `FR`, a requirement with sub-requirements through its `FR{n}.{m}` IDs) to the component or entity in `components.md` that realizes it; validated by the `traceability` sensor |

Additionally, a questions file is created as input:

| File                                      | Contents                                        |
|-------------------------------------------|-------------------------------------------------|
| `domain-design-questions.md`         | Design questions with `[Answer]:` tags          |

### Approval Gate

Special 3-option gate:

- **Approve** -- Continue to next stage
- **Request Changes** -- Provide revision feedback
- **Approve, and add Units Generation next** -- Approve, and include the
  currently skipped Units Generation stage (if it was skipped in the execution
  plan) via `aidlc engine orchestrate next --add units-generation`

### Notes

- Skip condition: changes are modifications to existing components only, with
  no new components or services needed.
- Boundary rationale (and any Alternatives Rejected) is captured in the
  Rationale section of `components.md`, and architectural decisions are
  logged in `decisions.md` (the ADR log).
- The design artifacts produced here are the primary input for Units Generation
  (2.6) and directly inform the per-unit stages (Functional Design 2.9, Code
  Generation 3.1).
- For brownfield projects, the design must account for integration with
  existing components documented in the RE artifacts.


---

## Stage 2.6: Units Generation

### Metadata

| Field            | Value                                                                  |
|------------------|------------------------------------------------------------------------|
| Phase            | Design                                                              |
| Stage #          | 2.6                                                                    |
| Condition        | ALWAYS -- produces the dependency DAG that Stage 2.8 consumes for Bolt sequencing; travels with 2.8 in the compiled scope grid |
| Lead Agent       | aidlc-architect-agent                                                        |
| Support Agents   | aidlc-delivery-agent                                                         |
| Mode             | inline                                                                 |
| Completion Emoji | :wrench:                                                               |

### Purpose

Units Generation decomposes the domain design into discrete Units of
Work that drives the per-unit flow in the Build phase. Each
Unit represents an independently implementable piece of the system (a
service, module, or deployable component). The stage produces the
`unit-of-work.md` file that the Build phase uses to determine what to build,
the dependency DAG (`unit-of-work-dependency.md`) that Stage 2.8 consumes
for Bolt sequencing, and the story map that ensures every user story (or every
functional requirement, when no stories are produced) is assigned to a Unit.

**Stage 2.6 produces the dependency DAG (topology). Stage 2.8 chooses the
economic path through it (the Bolt sequence).** 2.6 MUST NOT recommend an
implementation order or identify a critical path — those are 2.8's
economic-sequencing decisions.

This is a critical bridge stage between the Design phase's work and
the Build phase's implementation work. The unit definitions, dependencies, and
story mappings produced here directly control how the Build phase
executes.

The stage follows a two-part structure: PART 1 creates a decomposition plan
with clarifying questions and gets plan approval, and PART 2 generates the
actual unit artifacts.

### Inputs

- The component catalogue from Stage 2.5
  (`<record>/design/domain-design/components.md`)
- `<record>/design/requirements-analysis/requirements.md`
- `<record>/design/user-stories/stories.md` (if produced)

### Steps

**PART 1: Planning**

1. **Load Prior Context** -- Read all artifacts from
   `<record>/design/domain-design/` (the consolidated `components.md`
   component catalogue and the `decisions.md` ADR log). Read
   requirements. Read user stories (if produced). Scope context comes from
   `<record>/aidlc-state.md`.

2. **Create Decomposition Plan with Questions** -- Create
   `<record>/design/units-generation/units-generation-questions.md` with
   questions using `[Answer]:` tag format covering:
   - Unit boundary strategy (by service, by feature, by domain, by deployment
     target)
   - Unit granularity preference (coarse-grained vs. fine-grained)
   - Dependency ordering preferences (strict topological only, or allow
     parallelism between independent Units)
   - Integration points and contracts between Units (APIs, shared data, events)
   - Deployment model (monolithic deploy, independent deploy, hybrid)

   NOTE: Do NOT ask about implementation order priorities (value-first,
   risk-first, walking-skeleton-first). Those are economic-sequencing
   decisions that belong to Stage 2.8 Delivery Planning.

3. **Collect and Analyze Answers** -- Collect answers following
   stage-protocol.md section 3 question flow. MANDATORY ambiguity analysis:
   scan for vague language, contradictions, missing details. Create follow-up
   questions if ANY ambiguity found. Resolve all ambiguities before proceeding.

4. **Get Plan Approval** -- Present the decomposition plan to the user via
   AskUserQuestion: summarize the approach (unit boundary strategy, estimated
   unit count, dependency structure). Options: Approve Plan / Revise Plan.

**PART 2: Generation**

5. **Execute Plan -- Generate Unit Artifacts** -- Based on the approved plan,
   generate the 4 output artifacts (see Outputs below).

6. **Prepare Completion** -- Verify the unit artifacts and record the unit
   list for the Build phase. Do not edit state; report the gate outcome through
   `aidlc-orchestrate.ts`.

7. **Present Completion & Request Approval** -- Display completion message
   with :wrench: emoji, summary of units defined, dependencies mapped, stories
   assigned, and review path. Standard 2-option approval gate: Approve
   (continue to the next stage the engine names) / Request Changes.

### Outputs

All 4 artifacts written to `<record>/design/units-generation/`:

| File                            | Contents                                                    |
|---------------------------------|-------------------------------------------------------------|
| `unit-of-work.md`               | Unit definitions (name, description, boundaries), responsibilities, deployment model per Unit (standalone/shared/embedded), relative complexity estimate (S/M/L/XL), unit kind (`service`/`spec`/`ui`/`packaging`/`library`, drives which per-unit design artifacts apply), implementation notes and constraints |
| `unit-of-work-dependency.md`    | Dependency DAG between Units (directed edges, cycle-free), integration points (APIs/shared data/events), parallel development opportunities (sets of Units with no dependency between them). Topology only, economic path-choice (recommended order, critical path) is 2.8's job. The fenced `yaml` edge block mirrors the DAG and may tag each unit with an optional `kind:` (see [Runtime graph](../13-runtime-graph.md) `bolt_dag.units[].kind`) |
| `unit-of-work-story-map.md`     | One row per upstream item mapped to implementing Unit(s), keyed as the traceability enumeration is keyed (`USx.y` when `stories.md` is produced, and only `USx.y` rows are read; otherwise `FR`, a requirement with sub-requirements by its `FR{n}.{m}` IDs, plus optional `NFR` rows for any NFR the scope traces), cross-cutting rows spanning multiple Units, implementation order within each Unit, coverage verification (every enumerated ID assigned, every Unit has rows) |
| `traceability.json`             | Coverage table deriving the Unit set from the generated Unit artifacts and verifying every enumerated ID maps to its declared target Unit; validated by the `traceability` sensor |

Additionally, a questions file is created as input:

| File                                  | Contents                                          |
|---------------------------------------|---------------------------------------------------|
| `units-generation-questions.md`       | Decomposition questions with `[Answer]:` tags     |

### Approval Gate

Standard 2-option gate: **Approve** (continue to the next stage the engine
names) / **Request Changes**.

### Notes

- **This stage's output drives the Build phase.** The `unit-of-work.md` file
  defines the Units; `unit-of-work-dependency.md` is the DAG the
  engine walks. New source-producing solo Unit workflows default to unit-major,
  serial execution with verified Unit checkpoints. When skeleton-on applies,
  the first resolved DAG Unit must form the smallest working integrated slice.
  Explicit stage-major choices and legacy, design-only, and team-owned paths
  remain valid; the Bolt plan cannot reorder the actual DAG.
- **2.6 is ALWAYS when in scope.** In the compiled scope grid, 2.6 and 2.8 travel
  together (both EXECUTE or both SKIP per scope). There is no single-unit
  skip condition at this stage — single-Unit flows still produce a trivial
  DAG.
- The two-part structure (plan then generate) allows the user to approve the
  decomposition strategy before Units are defined. Step 4 has an intermediate
  approval gate (Approve Plan / Revise Plan) separate from the final
  completion gate.
- The dependency DAG feeds 2.8's economic Bolt sequencing. 2.8 chooses a
  path through the DAG weighted by risk, value, and learning.
- The story map provides traceability: every user story (or every functional
  requirement, when no stories are produced) must be assigned to at least one
  Unit, and every Unit must have at least one row.
- The aidlc-delivery-agent provides feasibility validation and prioritization input,
  ensuring the decomposition is practical from a delivery perspective.


---

## Stage 2.7: Contract Design

### Metadata

| Field            | Value                                                                  |
|------------------|------------------------------------------------------------------------|
| Phase            | Design                                                              |
| Stage #          | 2.7                                                                    |
| Condition        | CONDITIONAL -- execute whenever there is a contract to pin: an inter-unit boundary or a public/external API; skip only a single self-contained unit with neither |
| Lead Agent       | aidlc-architect-agent                                                        |
| Support Agents   | aidlc-aws-platform-agent                                                    |
| Mode             | inline                                                                 |
| Completion Emoji | :handshake:                                                            |

### Purpose

Contract Design formalises the system's **formal contracts** so that units can
be built in parallel against a stable, agreed boundary. It runs after Units
Generation (2.6) has defined the units and their dependency DAG, and pins two
kinds of contract: the inter-unit boundaries (the sync/async/shared-store
mechanisms by which units integrate) and any public or external API the system
exposes. It produces a single `contract-summary.md` that downstream design and
per-unit stages read as the authoritative boundary reference.

### Inputs

- `<record>/design/units-generation/unit-of-work.md` and
  `unit-of-work-dependency.md`
- `<record>/design/domain-design/components.md`
- `<record>/design/requirements-analysis/requirements.md`

### Outputs

- `contract-summary.md` -- the pinned inter-unit and external contracts.

### Notes

- Contract Design is skipped only for a single self-contained unit that has no
  inter-unit boundary and exposes no public/external API; a single unit that
  exposes a public API still runs it.
- `contract-summary` is consumed downstream by Delivery Planning, Functional
  Design, NFR Requirements, NFR Design, Infrastructure Design, and Code
  Generation as an optional shared-contract input.
- Unlike the other Design stages, Contract Design does not emit a
  `traceability.json`; it owns formal contracts rather than requirement
  coverage, so it does not contribute to the 2.8 phase-boundary traceability
  check.


---

## Stage 2.8: Delivery Planning

### Metadata

| Field            | Value                                                                  |
|------------------|------------------------------------------------------------------------|
| Phase            | Design                                                              |
| Stage #          | 2.8                                                                    |
| Condition        | ALWAYS -- capstone Design stage                                     |
| Lead Agent       | aidlc-delivery-agent                                                         |
| Support Agents   | aidlc-architect-agent (validates build order against architecture dependencies) |
| Mode             | inline                                                                 |
| Completion Emoji | :calendar:                                                             |

### Purpose

Delivery Planning is the capstone of the Design phase. It plans the Bolt
sequence — the economic order in which Units of Work produced by Stage 2.6
should ship. Where Stage 2.6 is analytical (the dependency DAG the
engine actually walks), Stage 2.8 is economic: it chooses a
path through the DAG weighted by risk, value, team capacity, and learning.
The engine does not consume `bolt-plan.md` for Unit grouping or runtime
order.

Per the canonical Glossary in `stage-protocol.md`, a **Bolt** is the
planned delivery slice for the Build phase from this stage (2.8): one or more
Units with a Definition of Done, a confidence hypothesis, and ownership.
(Stages 4.1 build-and-test and 6.1 ci-pipeline run once at end across
all Units, not per-Bolt.)

Economic value cannot be derived from the DAG — AI agents can topologically
sort, but they cannot decide which Bolt validates the market hypothesis
fastest or which surfaces the scariest unknown before commitments compound.
That is a human value judgment captured in this stage.

This stage also runs the phase boundary verification check that validates
the integrity of all Design artifacts before transitioning to
Build.

**Important distinction:** This stage plans Bolt sequencing. It does NOT
decide which AI-DLC stages to run or at what depth -- that is handled by the
`/aidlc` skill's scope selection.

### Inputs

All Design phase artifacts:

- Requirements from Stage 2.2 (`<record>/design/requirements-analysis/`)
- User stories from Stage 2.3 (`<record>/design/user-stories/`)
- Domain design from Stage 2.5
  (`<record>/design/domain-design/`)
- Units from Stage 2.6 (`<record>/design/units-generation/`)
- Contract summary from Stage 2.7, if produced
  (`<record>/design/contract-design/contract-summary.md`)
- Team formation from Stage 1.6
  (`<record>/discover/team-formation/`), if exists

### Steps

1. **Load Prior Context** -- Read all Design phase artifacts: requirements,
   user stories, domain design, units, the contract summary (if produced), and
   team formation (if exists).

2. **Generate Clarifying Questions** -- Create
   `<record>/design/delivery-planning/delivery-planning-questions.md`
   with questions covering:
   - Sequencing heuristic: risk-first, value-first, walking-skeleton-first,
     or hybrid
   - WSJF (Weighted Shortest Job First) scoring model and weightings if used
   - For eligible source-producing solo work with skeleton-on, the first DAG
     Unit as the smallest working integrated slice, its expected demo, and the
     real project check that will prove it
   - Bundling of Units of Work into Bolts
   - Definition of Done for each Bolt
   - Confidence hypothesis per Bolt — what will shipping it prove
   - Mob-to-Bolt assignment (references teams from 1.6 when available;
     AI-only when it did not run)
   - External dependencies (APIs, data, approvals) that gate specific Bolts
   - Key risk items to tackle earliest

   Follows stage-protocol.md question flow.

3. **Collect and Analyze Answers** -- Validate that the chosen Bolt
   sequence respects 2.6's dependency DAG (with aidlc-architect-agent input).
   Flag any deviation from topological order so it can be justified in the
   rationale artifact.

4. **Generate Artifacts** -- Create four artifacts in
   `<record>/design/delivery-planning/`:
   - `bolt-plan.md` — the ordered sequence of Bolts; per-Bolt Units of
     Work, walking-skeleton marker, Definition of Done, confidence
     hypothesis, expected demo.
   - `team-allocation.md` — Bolt-to-mob assignments; Program Board analog
     when team count > 1.
   - `risk-and-sequencing-rationale.md` — the why behind the Bolt order:
     WSJF score, risk-first argument, walking-skeleton-first argument, or
     value-first argument.
   - `external-dependency-map.md` — gated items mapped to consuming Bolts
     (lightweight or empty when fully AI-contained).

5. **Phase Boundary Verification** -- Run Design-to-Build
   verification check:
   - Requirements to Stories to Architecture alignment
   - All stories trace to requirements
   - Architecture covers all stories
   - Write results to `<record>/verification/phase-check-design.md`

6. **Prepare Completion** -- Verify the delivery and boundary-verification
   artifacts. Do not write the phase or stage state; the approval report owns
   the atomic Design-to-Build transition. Preserve a recorded
   iteration choice. Eligible new source-producing solo Unit workflows start
   unit-major and serial; an explicit swarm choice requires stage-major first,
   then `state set-construction-execution swarm`. Approval mode is a separate
   decision. Confirm the first integrated Unit when skeleton-on applies. For
   checkpoint-enabled work, propose a real project check from the scan and show
   **Use this command to verify each completed Unit?** with the exact command
   and **Approve** / **Request Changes**. Before presenting the command, write it
   to `<record>/verification-command.txt` using the harness's file-write
   tool (Write/edit), never a shell `echo` or heredoc. Repo-derived command text
   must never be interpolated into a shell line, where substitutions could run
   before approval. Both `log decision` and `log answer` take
   `--checkpoint verification-command --command-file verification-command.txt`
   and find the session they run in.
   Record the decision before asking and wait for the human's **Approve** /
   **Request Changes** reply, in that chat or a new one while it is the newest
   question asked. Record the answer with the same stage/checkpoint/command;
   only **Approve** authorizes the receipt. An unrelated reply, **Request
   Changes**, or a reply to another question does not. Never write `--details "Approve"` unless the human chose it; only then run
   `state set-construction-verification-command --command-file verification-command.txt`. **Request Changes** means
   propose another command. The receipt must precede the state field; never use
   generic `state set` or auto-approve. This command is reused for all Unit/batch
   checkpoints and changes require a new receipt.
   If no runnable check exists yet (greenfield), the human may defer; the first
   checkpoint then asks before verification. See the
   [exact recording commands](../../guide/12-cli-commands.md#construction-verification-command-record-human-authorization).
   Who builds the Units is not this stage's question: with two or more Units,
   the engine asks it once at the first step into the per-unit stages, after this
   stage's approval (see
   [Construction Execution](../03-orchestrator.md#construction-execution)).

7. **Present Completion & Request Approval** -- Display completion message
   with :calendar: emoji. Approval gate: Approve (proceed to Build) /
   Request Changes. The user can override stage inclusion/exclusion at this
   gate.

### Outputs

All artifacts written to `<record>/design/delivery-planning/`:

| File                                  | Contents                                                    |
|---------------------------------------|-------------------------------------------------------------|
| `bolt-plan.md`                        | Ordered Bolt sequence; per-Bolt Units of Work, walking-skeleton marker, Definition of Done, confidence hypothesis, expected demo |
| `team-allocation.md`                  | Bolt-to-mob assignment; Program Board analog when team count > 1; AI-only assignment when 1.6 did not run |
| `risk-and-sequencing-rationale.md`    | WSJF / risk-first / walking-skeleton-first / value-first justification for the Bolt ordering |
| `external-dependency-map.md`          | Gated items (external APIs, data availability, approval lead times, external-team hand-offs) mapped to consuming Bolts |
| `delivery-planning-questions.md`      | Clarifying questions with `[Answer]:` tags (input artifact) |

Phase boundary verification output:

| File                                            | Contents                                    |
|-------------------------------------------------|---------------------------------------------|
| `<record>/verification/phase-check-design.md` | Design-to-Build traceability check results |

### Approval Gate

Standard 2-option gate: **Approve** (proceed to Build) / **Request
Changes**. The user can override stage inclusion/exclusion at this gate.

### Notes

- **Phase boundary stage.** This is the second of three phase boundary stages
  (after 1.8 and before 6.1). The verification check validates
  Requirements-to-Stories-to-Architecture alignment.
- **Economic vs topological sequencing.** Stage 2.6 produces the dependency
  DAG (topological order falls out as descriptive geometry). Stage 2.8
  chooses a path through that DAG weighted by human value judgment.
  The planning rationale may propose delivery groupings, but execution still
  respects the actual DAG. When the first Unit cannot deliver the required
  integrated skeleton, revisit the decomposition before Build; moving a
  marker in `bolt-plan.md` does not change which Unit the engine runs first.
- **Bolt ≠ sprint ≠ MMF.** Per the canonical Glossary, a Bolt is the
  planned delivery slice for the Build phase from 2.8: one or more Units with a
  Definition of Done, a confidence hypothesis, and ownership. Stages 4.1
  (Build and Test) and 6.1 (CI Pipeline) run once after all Bolts.
  Sequencing heuristics (walking skeleton, WSJF) apply to Bolt order;
  they do not redefine what a Bolt is.
- **Deliberate deviation from upstream.** The upstream reference calls this
  stage "Workflow Planning" and treats it as a pure stage selector. This
  implementation (renamed to "Delivery Planning") adds Bolt sequencing,
  team allocation, and risk rationale.
- The bolt plan defines a confidence-building sequence. Each Bolt has
  defined Units of Work, a Definition of Done, and a confidence hypothesis.
- The aidlc-architect-agent validates that the proposed Bolt sequence respects
  dependencies defined in the component catalogue (`components.md`) and the
  unit-of-work-dependency artifact.
- Team allocation draws from the Team Formation artifacts (Stage 1.6) if
  they exist; when 1.6 is SKIP (mvp, classic, workshop), every Bolt is planned
  for aidlc-developer-agent (AI). The allocation is a plan, not the decision.


---

## Stage 2.9: Functional Design

### Metadata

| Property          | Value                                                                                             |
|-------------------|---------------------------------------------------------------------------------------------------|
| Stage             | 2.9                                                                                               |
| Phase             | Design                                                                                      |
| Execution         | CONDITIONAL (per execution plan)                                                                  |
| Condition         | New data models, complex business logic, or business rules need design. Skip if simple logic changes with no new business logic. |
| Per-Unit          | Yes                                                                                               |
| Lead Agent        | aidlc-architect-agent                                                                                   |
| support_agents    | aidlc-developer-agent                                                                                   |
| mode              | inline                                                                                            |
| Inputs            | unit-of-work.md, unit-of-work-story-map.md, stories.md (if produced), requirements.md, domain design artifacts |
| Outputs           | `<record>/design/{unit-name}/functional-design/` -- functional-spec.md, rules.md, entities.md, traceability.json, CONDITIONAL: frontend-components.md (per Unit kind) |

### Purpose

Design the business logic, domain model, and rules for a single unit of work.
The aidlc-architect-agent leads with the aidlc-developer-agent providing technical
feasibility input.

### Inputs

- Unit definition from `<record>/design/units-generation/unit-of-work.md`
- Assigned stories from `<record>/design/units-generation/unit-of-work-story-map.md`
- Acceptance criteria of those stories from `<record>/design/user-stories/stories.md` (if produced)
- Requirements from `<record>/design/requirements-analysis/requirements.md`
- Domain design artifacts from `<record>/design/domain-design/`

### Steps

1. **Read Unit Context** -- Read the unit definition, assigned stories and
   their acceptance criteria, requirements, and domain design artifacts.

2. **Create Functional Design Plan** -- Analyze the unit's scope and create a
   questions file at
   `<record>/design/{unit-name}/functional-design/functional-design-questions.md`
   with context-appropriate questions using `[Answer]:` tags. Focus areas:
   - Business logic workflows and algorithms
   - Domain models and entity relationships
   - Business rules, constraints, and validation logic
   - Data flow and transformations
   - Integration points with other units or external systems
   - Error handling and edge cases (at Standard and Comprehensive depth, swept
     per component against the product agent's `corner-checklist.md`; corners
     the requirements already settled carry forward)
   - Frontend components (component hierarchy, props/state, interaction flows,
     form validation)
   - Business scenarios (end-to-end user journeys, happy/unhappy paths,
     concurrency edge cases)

3. **Collect and Analyze Answers** -- Collect answers following
   stage-protocol.md question flow (collect
   answers, write back to file). Perform MANDATORY ambiguity analysis:
   - Identify vague answers ("mix of", "not sure", "depends")
   - Check for contradictions between answers
   - Flag missing details needed for artifact generation
   - If ANY ambiguity found: create follow-up questions and resolve before
     proceeding

4. **Generate Artifacts** -- Generate the following in
   `<record>/design/{unit-name}/functional-design/`:
   - **functional-spec.md**: Detailed algorithms, workflows, data
     transformations, processing sequences, and decision trees for the unit's
     business logic
   - **rules.md**: Decision rules, validation logic, constraints,
     policies, conditional behavior, and business invariants
   - **entities.md**: Entities, relationships, data structures,
     attributes, lifecycle states, and entity interaction patterns
   - **frontend-components.md** (CONDITIONAL -- only if unit includes
     frontend/UI): Component hierarchy, props/state design, interaction flows,
     form validation rules, API integration points

5. **Prepare Completion** -- Verify the unit's Functional Design artifacts.
   Do not edit state; report the gate outcome through `aidlc-orchestrate.ts`.

6. **Completion** -- Present completion message and approval gate.

### Outputs

| Artifact                 | Description                                                              |
|--------------------------|--------------------------------------------------------------------------|
| functional-spec.md  | Algorithms, workflows, data transformations, processing sequences, decision trees |
| rules.md        | Decision rules, validation logic, constraints, policies, conditional behavior |
| entities.md       | Entities, relationships, data structures, attributes, lifecycle states   |
| frontend-components.md   | (CONDITIONAL) Component hierarchy, props/state, interaction flows, form validation, API integration |
| traceability.json        | Every acceptance criterion of each story mapped to the Unit (without stories.md, the Unit's FR rows in the story map; without a story map, every FR; a requirement with sub-requirements through its `FR{n}.{m}` IDs), each `OK` to `BRx.y` rules in rules.md (a Unit whose kind writes no `rules.md`, such as `ui`, names its `functional-spec.md` or `frontend-components.md` instead), `N/A` or `Deferred` with its reason, or `GAP` |

Which files a Unit gets follows its kind: a `ui` Unit gets no entities.md or
rules.md, only a `ui` Unit gets frontend-components.md, and a `packaging`
Unit gets none of them.

### Approval Gate

Strictly 2-option: Approve / Request Changes.

### Notes

- The questions file is co-located with stage artifacts at
  `<record>/design/{unit-name}/functional-design/functional-design-questions.md`.
- frontend-components.md is only produced when the unit includes frontend/UI
  work.
- All questions use the tri-mode interaction flow (Guide me / I'll edit the
  file / Chat).


---

## Stage 2.10: NFR Requirements

### Metadata

| Property          | Value                                                                                             |
|-------------------|---------------------------------------------------------------------------------------------------|
| Stage             | 2.10                                                                                               |
| Phase             | Design                                                                                      |
| Execution         | CONDITIONAL (per execution plan)                                                                  |
| Condition         | Performance, security, scalability, reliability, or observability requirements needed, or tech stack selection needed. Skip if no NFR requirements and tech stack already determined. |
| Per-Unit          | Yes                                                                                               |
| Lead Agent        | aidlc-architect-agent                                                                                   |
| support_agents    | aidlc-devsecops-agent, aidlc-compliance-agent, aidlc-quality-agent                                       |
| mode              | inline                                                                                            |
| Inputs            | functional design artifacts, requirements.md, RE artifacts                                        |
| Outputs           | `<record>/design/{unit-name}/nfr-requirements/` -- performance-requirements.md, security-requirements.md, scalability-requirements.md, reliability-requirements.md, observability-requirements.md, tech-stack-decisions.md, traceability.json (per Unit kind) |

### Purpose

Define non-functional requirements across performance, security, scalability,
reliability, observability, and technology selection for a single unit. The aidlc-architect-agent
leads, with the aidlc-devsecops-agent providing security input, the
aidlc-compliance-agent providing regulatory input, and the aidlc-quality-agent
providing testability and measurability input.

### Inputs

- Functional design artifacts from
  `<record>/design/{unit-name}/functional-design/` (if they exist)
- Requirements from `<record>/design/requirements-analysis/requirements.md`
- Reverse engineering artifacts from
  `aidlc/spaces/<active-space>/codekb/<repo>/` (if they exist)

### Steps

1. **Read Prior Artifacts** -- Read functional design artifacts (if they
   exist), requirements, and reverse engineering artifacts.

2. **Assess NFR Categories** -- Analyze the unit across NFR categories:
   - **Performance**: Response times, throughput, latency targets, resource
     utilization
   - **Security**: Authentication, authorization, data protection, compliance
     requirements
   - **Scalability**: Load handling, growth projections, scaling strategies
   - **Reliability**: Availability targets, fault tolerance, disaster recovery,
     data durability
   - **Observability**: Monitoring, logging, alerting, tracing requirements

3. **Generate Questions** -- Create a questions file at
   `<record>/design/{unit-name}/nfr-requirements/nfr-requirements-questions.md`
   for unclear NFR areas using `[Answer]:` tags. Focus on quantifiable targets
   and specific constraints.

4. **Collect and Analyze Answers** -- Collect answers following
   stage-protocol.md question flow. Perform MANDATORY ambiguity analysis:
   - Identify vague answers ("fast enough", "highly available", "secure")
   - Check for contradictions between NFR targets
   - Flag missing quantitative targets
   - If ANY ambiguity found: create follow-up questions and resolve before
     proceeding

5. **Generate Artifacts** -- Generate the following in
   `<record>/design/{unit-name}/nfr-requirements/`:
   - **performance-requirements.md**: Response time targets, throughput
     requirements, latency budgets, resource constraints, benchmarks
   - **security-requirements.md**: Authentication requirements, authorization
     model, data protection, compliance, threat considerations
   - **scalability-requirements.md**: Load projections, scaling triggers,
     capacity planning, data growth, concurrency targets
   - **reliability-requirements.md**: Availability targets (SLA/SLO), fault
     tolerance requirements, backup/recovery, graceful degradation
   - **observability-requirements.md**: Monitoring requirements, logging
     standards, distributed tracing needs, alerting thresholds, dashboard
     requirements, SLI/SLO definitions
   - **tech-stack-decisions.md**: Technology selections and rationale --
     languages, frameworks, databases, infrastructure tools, and justification
     for each choice

6. **Prepare Completion** -- Verify the unit's NFR Requirements artifacts.
   Do not edit state; report the gate outcome through `aidlc-orchestrate.ts`.

7. **Completion** -- Present completion message and approval gate.

### Outputs

| Artifact                     | Description                                                                |
|------------------------------|----------------------------------------------------------------------------|
| performance-requirements.md  | Response times, throughput, latency budgets, resource constraints, benchmarks |
| security-requirements.md     | Authentication, authorization, data protection, compliance, threats        |
| scalability-requirements.md  | Load projections, scaling triggers, capacity planning, concurrency         |
| reliability-requirements.md  | Availability targets (SLA/SLO), fault tolerance, backup/recovery           |
| observability-requirements.md | Monitoring, logging, tracing, alerting, dashboards, SLI/SLO definitions    |
| tech-stack-decisions.md      | Technology selections with rationale for each choice                       |
| traceability.json            | Every `NFR{n}` from Design (when User Stories did not run and the story map gives the Unit NFR rows, those) mapped to its `NFRx.y` IDs, or `N/A` with the reason it does not apply |

Which files a Unit gets follows its kind: scalability, reliability and
observability requirements are for `service` Units, and performance for
`service` and `ui` Units.

### Approval Gate

Strictly 2-option: Approve / Request Changes.

### Notes -- NFR Granularity Expansion

This stage produces **6 Markdown artifacts** plus `traceability.json`,
expanded from the upstream reference which defines only 2 files for NFR
Requirements. The finer
granularity improves traceability and allows per-concern review without
overloading a single document. The six files separate performance, security,
scalability, reliability, and observability into dedicated artifacts, and add
a dedicated tech-stack-decisions.md for technology selection rationale.


---

## Stage 2.11: NFR Design

### Metadata

| Property          | Value                                                                                             |
|-------------------|---------------------------------------------------------------------------------------------------|
| Stage             | 2.11                                                                                               |
| Phase             | Design                                                                                      |
| Execution         | CONDITIONAL (only if NFR Requirements was executed)                                               |
| Condition         | NFR Requirements was executed and NFR patterns need design. Skip if NFR Requirements was skipped. |
| Per-Unit          | Yes                                                                                               |
| Lead Agent        | aidlc-architect-agent                                                                                   |
| support_agents    | aidlc-aws-platform-agent                                                                                |
| mode              | inline                                                                                            |
| Inputs            | NFR requirements artifacts, functional design artifacts                                           |
| Outputs           | `<record>/design/{unit-name}/nfr-design/` -- performance-design.md, security-design.md, scalability-design.md, reliability-design.md, observability-design.md, logical-components.md, traceability.json (per Unit kind) |

### Purpose

Translate NFR requirements into concrete design patterns and architectural
solutions. The aidlc-architect-agent leads with the aidlc-aws-platform-agent providing
infrastructure and platform input.

### Inputs

- NFR requirements from `<record>/design/{unit-name}/nfr-requirements/`
- Functional design artifacts from
  `<record>/design/{unit-name}/functional-design/` (if they exist)
- Domain design from `<record>/design/domain-design/` for
  architectural context

### Steps

1. **Read Prior Artifacts** -- Read NFR requirements, functional design
   artifacts (if they exist), and domain design for architectural context.

2. **Generate Design Questions** -- Create a questions file at
   `<record>/design/{unit-name}/nfr-design/nfr-design-questions.md`
   with context-appropriate questions using `[Answer]:` tags. Focus areas:
   - Resilience patterns (circuit breakers, bulkheads, fallback strategies)
   - Scalability patterns (horizontal vs vertical, data partitioning, caching
     tiers)
   - Performance optimization (latency budgets, throughput targets, resource
     pooling)
   - Security approach (defense in depth, zero trust, encryption standards)
   - Observability approach (metrics and SLI/SLO targets, structured logging,
     tracing depth, alerting philosophy, dashboard needs)
   - Logical component boundaries (service isolation, failure domains, blast
     radius)

3. **Collect and Analyze Answers** -- Collect answers following
   stage-protocol.md question flow. Perform MANDATORY ambiguity analysis:
   - Identify vague answers ("mix of", "not sure", "depends")
   - Check for contradictions between answers
   - Flag missing details needed for artifact generation
   - If ANY ambiguity found: create follow-up questions and resolve before
     proceeding

4. **Design NFR Solutions** -- Design concrete solutions for each NFR
   category:
   - **Performance**: Caching strategies, query optimization, connection
     pooling, async processing, CDN usage, lazy loading, pagination
   - **Security**: Authentication flows, authorization model, encryption (at
     rest and in transit), input validation, CSRF/XSS protection, secrets
     management, audit logging
   - **Scalability**: Horizontal/vertical scaling approach, load balancing,
     data partitioning/sharding, queue-based decoupling, stateless design
   - **Reliability**: Circuit breakers, retry policies with backoff, health
     checks, graceful degradation, failover strategies, data replication
   - **Observability**: Metrics collection strategy, structured logging design,
     distributed tracing architecture, alerting rules, dashboard specifications,
     SLI/SLO tracking, correlation ID propagation

5. **Generate Artifacts** -- Generate the following in
   `<record>/design/{unit-name}/nfr-design/`:
   - **performance-design.md**: Caching architecture, optimization strategies,
     resource pooling, async patterns, performance budgets
   - **security-design.md**: Authentication/authorization architecture,
     encryption design, input validation strategy, security headers, compliance
     controls
   - **scalability-design.md**: Scaling architecture, load distribution, data
     partitioning strategy, capacity thresholds, auto-scaling rules
   - **reliability-design.md**: Resilience patterns, circuit breaker
     configuration, retry policies, health check design, failover procedures,
     backup strategy
   - **observability-design.md**: Metrics collection architecture, structured
     logging design, distributed tracing strategy, alerting rules and escalation,
     dashboard specifications, SLI/SLO definitions, correlation ID propagation
   - **logical-components.md**: Logical infrastructure component inventory --
     service boundaries, failure domains, blast radius mapping, component
     isolation strategy, shared resource identification. Bridges NFR design
     decisions with Infrastructure Design by providing a component-level view
     of where NFR patterns apply.

6. **Prepare Completion** -- Verify the unit's NFR Design artifacts. Do not
   edit state; report the gate outcome through `aidlc-orchestrate.ts`.

7. **Completion** -- Present completion message and approval gate.

### Outputs

| Artifact               | Description                                                                     |
|------------------------|---------------------------------------------------------------------------------|
| performance-design.md  | Caching architecture, optimization strategies, resource pooling, async patterns |
| security-design.md     | Auth architecture, encryption design, input validation, security headers        |
| scalability-design.md  | Scaling architecture, load distribution, data partitioning, auto-scaling rules  |
| reliability-design.md  | Resilience patterns, circuit breakers, retry policies, failover procedures      |
| observability-design.md | Metrics, structured logs, tracing, alerts, dashboards, SLI/SLO definitions      |
| logical-components.md  | Component inventory, service boundaries, failure domains, blast radius mapping  |
| traceability.json      | Every `NFRx.y` from the Unit's NFR requirements mapped to its design solution   |

Which files a Unit gets follows its kind, as in NFR Requirements; `spec` and
`packaging` Units get no logical-components.md.

### Approval Gate

Strictly 2-option: Approve / Request Changes.

### Notes -- NFR Design Granularity

This stage produces **6 Markdown artifacts** (5 NFR-specific designs plus
logical-components.md) and `traceability.json`, expanded from the upstream
reference which defines only 2 files for NFR Design. The logical-components.md artifact
serves as a bridge between NFR design and Infrastructure Design (Stage 2.12)
by mapping where NFR patterns apply at the component level.


---

## Stage 2.12: Infrastructure Design

### Metadata

| Property          | Value                                                                                             |
|-------------------|---------------------------------------------------------------------------------------------------|
| Stage             | 2.12                                                                                               |
| Phase             | Design                                                                                      |
| Execution         | CONDITIONAL (per execution plan)                                                                  |
| Condition         | Infrastructure services need mapping, deployment architecture required, or cloud resources needed. Skip if no infrastructure changes and infrastructure already defined. |
| Per-Unit          | Yes                                                                                               |
| Lead Agent        | aidlc-aws-platform-agent                                                                                |
| support_agents    | aidlc-devsecops-agent, aidlc-compliance-agent                                                           |
| mode              | inline                                                                                            |
| Inputs            | NFR design artifacts, domain design, functional design                                       |
| Outputs           | `<record>/design/{unit-name}/infrastructure-design/` -- infrastructure-specification.md (deployment + services + CONDITIONAL shared), monitoring-design.md, cicd-pipeline.md, traceability.json (per Unit kind) |

### Purpose

Design the infrastructure, deployment architecture, monitoring, and CI/CD
pipeline for a single unit. The aidlc-aws-platform-agent leads, with the
aidlc-devsecops-agent ensuring infrastructure security and the
aidlc-compliance-agent checking data residency and regulatory constraints.

### Inputs

- NFR design from `<record>/design/{unit-name}/nfr-design/` (if exists)
- Functional design from
  `<record>/design/{unit-name}/functional-design/` (if exists)
- Domain design from `<record>/design/domain-design/`
- NFR requirements from
  `<record>/design/{unit-name}/nfr-requirements/` (if exists)

### Steps

1. **Read Prior Artifacts** -- Read all prior design artifacts for context:
   NFR design, functional design, domain design, NFR requirements.

2. **Generate Infrastructure Questions** -- Create a questions file at
   `<record>/design/{unit-name}/infrastructure-design/infrastructure-design-questions.md`
   with context-appropriate questions using `[Answer]:` tags. Focus areas:
   - Deployment strategy (containerized, serverless, hybrid, multi-region)
   - Compute/storage/networking (sizing, topology, latency requirements)
   - Monitoring approach (metrics, logging, tracing, alerting thresholds)
   - CI/CD pipeline (build stages, deployment strategy, rollback procedures)
   - Secrets management (vault, environment variables, rotation policy)
   - Scaling policy (auto-scaling triggers, capacity limits, cost constraints)

3. **Collect and Analyze Answers** -- Collect answers following
   stage-protocol.md question flow. Perform MANDATORY ambiguity analysis:
   - Identify vague answers ("cloud-based", "auto-scale", "standard
     monitoring")
   - Check for contradictions between answers
   - Flag missing details needed for artifact generation
   - If ANY ambiguity found: create follow-up questions and resolve before
     proceeding

4. **Design Infrastructure** -- Design infrastructure across four areas:
   - **Deployment Architecture**: Compute model (containers, serverless, VMs),
     networking topology, storage strategy, environment layout
     (dev/staging/prod)
   - **Infrastructure Services**: Databases (type, sizing, replication), caches
     (strategy, eviction), message queues, search services, CDN, DNS, load
     balancers
   - **Monitoring & Observability**: Metrics collection, log aggregation,
     distributed tracing, alerting rules, dashboards, SLI/SLO tracking
   - **CI/CD Pipeline**: Build stages, test stages, deployment stages,
     environment promotion, rollback strategy, feature flags, artifact
     management

5. **Generate Artifacts** -- Generate the following in
   `<record>/design/{unit-name}/infrastructure-design/`. Keep the content
   **tabular** (deployment, services, shared, and monitoring are tables):
   - **infrastructure-specification.md**: the core infra design — a
     **Deployment** table (compute, networking, storage, environments, IaC,
     sizing), an **Infrastructure Services** table (databases, caches,
     messaging, integrations, service discovery), and a CONDITIONAL **Shared
     Infrastructure** table (shared resources across units + ownership/access
     boundaries), all in one document
   - **monitoring-design.md**: the monitoring that implements NFR Design's
     observability-design strategy, tabular — metrics/KPIs,
     alerts, SLIs/SLOs, plus log-aggregation and tracing configuration and
     dashboard specifications
   - **cicd-pipeline.md**: pipeline stages, build configuration, test
     automation integration, deployment strategy (blue-green, canary, rolling),
     rollback procedures, environment promotion, secrets management in CI/CD

6. **Prepare Completion** -- Verify the unit's Infrastructure Design
   artifacts. Do not edit state; report the gate outcome through
   `aidlc-orchestrate.ts`.

7. **Completion** -- Present completion message and approval gate.

### Outputs

| Artifact                       | Description                                                               |
|--------------------------------|---------------------------------------------------------------------------|
| infrastructure-specification.md | Deployment (compute/networking/storage/environments/IaC), infrastructure services, and CONDITIONAL shared resources — tabular |
| monitoring-design.md           | Metrics, alerts, SLIs/SLOs, logs, tracing, dashboards — tabular where possible |
| cicd-pipeline.md               | Pipeline stages, build config, deployment strategy, rollback procedures   |
| traceability.json              | Every `NFRx.y` design decision that needs infrastructure mapped to its resource or configuration |

Which files a Unit gets follows its kind: a `spec` Unit gets none of them,
and a `library` Unit only cicd-pipeline.md and traceability.json.

### Approval Gate

Strictly 2-option: Approve / Request Changes.

### Notes -- Infrastructure Design Consolidation

This stage produces **3 Markdown artifacts** plus `traceability.json`. Deployment, infrastructure services,
and shared resources were consolidated into a single tabular
`infrastructure-specification.md` (closer to the upstream reference's single
infra doc), while `monitoring-design.md` and `cicd-pipeline.md` stay dedicated
artifacts because downstream Operate stages consume them independently
(observability-setup reads monitoring; deployment-pipeline reads the CI/CD
design). Shared infrastructure is a CONDITIONAL section of the specification,
present only when multiple units share resources.


---

## Phase Summary

### Key Outputs

The Discover and Design phases produce the following key outputs that carry forward into
later phases:

1. **Reverse Engineering Artifacts** (1.4, Discover) -- 9 artifacts per repository at
   `aidlc/spaces/<active-space>/codekb/<repo>/`, documenting the existing
   codebase: business overview, architecture, code structure, API documentation,
   component inventory, technology stack, dependencies, code quality
   assessment, and timestamp. (Brownfield projects only.)
2. **Requirements Document** (2.2) -- Formal requirements: functional,
   non-functional, constraints, assumptions, out-of-scope, open questions.
3. **User Stories and Personas** (2.3) -- User stories with acceptance
   criteria, priorities, and dependencies; user persona definitions. (When
   applicable.)
4. **Refined Mockups** (2.4) -- Mid-to-high fidelity mockups, interaction
   specifications, design system mapping, accessibility checklist. (When
   applicable.)
5. **Domain Design** (2.5) -- The consolidated `components.md` catalogue
   (each component's behaviour, responsibilities, dependencies, external
   dependencies, and owned entities) plus the `decisions.md` ADR log.
   (When applicable.)
6. **Units of Work** (2.6) -- Unit definitions with boundaries and complexity
   estimates, unit dependency matrix with build order, story-to-unit mapping.
   (When applicable.) `unit-of-work-dependency.md` is the artifact the
   engine reads for Unit grouping and runtime batch order.
7. **Contract Summary** (2.7) -- The pinned inter-unit and public/external API
   contracts (`contract-summary.md`). (When there is a contract to pin.)
8. **Delivery Plan** (2.8) -- Bolt plan, build order, dependency matrix, team
   allocation. Approved planning content (economic sequence, multi-Unit
   grouping, DoD, confidence hypothesis, ownership) — not the runtime walk
   source.
9. **Phase Boundary Verification** (2.8) -- Design-to-Build
   traceability check written to
   `<record>/verification/phase-check-design.md`.

### Handoff to Build

Upon approval at Stage 2.8, the framework moves on to the Unit walk: the
per-Unit design stages (2.9–2.12) and Build. `bolt-plan.md` stays the
approved planning artifact — economic sequence, multi-Unit Bolt grouping,
Definition of Done, confidence hypothesis, and ownership. The engine does **not** consume it for Unit
grouping or walk order. Runtime batches are computed from
`unit-of-work-dependency.md` (2.6).

For new source-producing solo Unit workflows, the default is **unit-major,
serial execution with verified checkpoints**. Each Unit finishes its applicable
per-unit stages before the next. With skeleton-on, the first DAG Unit must
produce a working integrated slice, pass the recorded, human-authorized
end-to-end verification command, and receive human skeleton approval before
later Units start, even with stage-major chosen.
The legacy first-stage gate is a stage review, not proof of that result.
The verifier records a tool-owned `CHECKPOINT_VERIFICATION_RECORDED` receipt
alongside the proof file, and approval requires that receipt; a hand-written
proof file cannot verify a Unit. On a checkout with no proof file at all (a
fresh clone, another machine), that receipt stands in for the proof of a Unit
already approved whose evidence is unchanged, so nothing runs again.

Eligible skeleton-off flows offer **Continue automatically** / **Review each
checkpoint** at the first per-unit stage; skeleton-on offers after the real skeleton
checkpoint. Known choices are not repeated. Plan Approval, verification command
selection, and enabled summary confirmation remain human-required under either
choice; summary confirmation applies only when
`directive.ceremony.summary_confirmation === "on"`. Explicit
stage-major/swarm selection controls parallel execution independently of
completion approval.

Existing workflows without checkpoints, design-only work, no-Unit flows, and
team-owned gates retain their existing behavior. Preserve explicit iteration
choices. After all applicable Unit work, Build and Test, the Secure reviews and
optional CI Pipeline run once across the solution. See the Construction protocol for metadata routing
and completion-only bookkeeping.

See the [Unit Walk](build.md#unit-walk) for the per-unit flow.

### Cross-References

- **Orchestrator**: `harness/claude/skills/aidlc/SKILL.md` --
  Routing logic, scope-to-stage mapping, stage graph, per-unit flow
  definition
- **Stage Protocol**: `core/aidlc-common/protocols/stage-protocol.md`
  -- Approval gates, question format, completion messages, and the §13 Learnings
  Ritual.
- **Discover Phase**: [Discover](discover.md) -- Previous phase
  documentation
- **Build Phase**: [Build](build.md) — conditional
  checkpoint default, explicit execution choices, and preserved legacy paths;
  `bolt-plan.md` is planning, not the runtime walk source


---

**Deliberate deviations from upstream reference:**
- NFR Requirements: 6 Markdown files plus traceability.json (expanded from 2 in reference)
- NFR Design: 6 Markdown files including logical-components.md, plus
  traceability.json (expanded from 2 in reference)
- Infrastructure Design: 3 Markdown files plus traceability.json: a consolidated infrastructure-specification.md
  (deployment + services + shared) plus dedicated monitoring-design.md and
  cicd-pipeline.md
- Plan/question file co-location with stage artifacts

---
slug: security-review
name: Security Review
phase: secure
execution: ALWAYS
condition: Always executes after code-review; the review covers authentication, authorization, data handling, secrets, dependencies and infrastructure.
lead_agent: aidlc-devsecops-agent
support_agents: []
mode: inline
produces:
  - security-review-report
  - security-findings
consumes:
  - artifact: code-review-findings
    required: true
  - artifact: security-design
    required: false
  - artifact: infrastructure-specification
    required: false
requires_stage:
  - code-review
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
inputs: code review findings, security design, infrastructure specification
outputs: "security-review-report.md and security-findings.md (under this stage's record dir, engine-resolved)"
---

# Security Review

## Steps

### Step 1: Map the Attack Surface

List the entry points, trust boundaries, data stores and external integrations
found in the code and the infrastructure specification.

### Step 2: Check Each Control

Check input validation, authentication and session handling, authorization on
every entry point, secrets handling, encryption in transit and at rest, dependency
versions with known vulnerabilities, logging of sensitive data, and the
infrastructure's network and identity settings. Record each finding with its
location, its severity, and a concrete fix.

### Step 3: Write the Review

Write `security-review-report.md` with the attack surface summary, findings by
severity, and the items that block deployment. Write each finding to
`security-findings.md` with an ID.

### Step 4: Completion Handoff

Present the blocking findings to the person for a decision. Do not fix code in
this stage.

Hand completion to `stage-protocol.md` via
`{{INVOKE}} engine orchestrate report --stage security-review --result <outcome>`.
That `report` call owns every lifecycle transition and advancement; never perform one in prose, and never narrate this bookkeeping to the user.

Approval gate: strictly 2-option (Approve / Request Changes).

## Sensors

Required-sections check on `security-review-report.md`.

## Learn

When `directive.protocol_modules` lists `learnings`, follow
`stage-protocol-learnings.md`: keep the diary at `directive.memory_path` while
working, and take the learnings step before the approval gate; that module says
when it asks the person anything. When the module is absent, skip both the diary
and the step.

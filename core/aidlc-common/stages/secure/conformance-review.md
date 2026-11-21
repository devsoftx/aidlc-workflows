---
slug: conformance-review
name: Conformance Review
phase: secure
execution: CONDITIONAL
condition: Execute when the project has written requirements, standards or regulatory obligations that the delivered code must meet.
lead_agent: aidlc-compliance-agent
support_agents: []
mode: inline
produces:
  - conformance-report
consumes:
  - artifact: requirements
    required: false
  - artifact: rules
    required: false
  - artifact: security-review-report
    required: true
requires_stage:
  - security-review
scopes:
  - enterprise
  - security-patch
  - infra
  - classic
sensors:
  - required-sections
inputs: requirements, team and project rules, security review report
outputs: "conformance-report.md (under this stage's record dir, engine-resolved)"
---

# Conformance Review

## Steps

### Step 1: Collect the Obligations

Read the requirements and the org, team and project rules. List each obligation
that the delivered code must meet, with its source.

### Step 2: Check the Delivered Code

For each obligation, check the code, tests and deployment settings that show it is
met. Mark each obligation as met, partly met, or not met, and cite the evidence.

### Step 3: Write the Report

Write `conformance-report.md` with one row per obligation, its status and its
evidence. List every not-met obligation as a blocker for deployment.

### Step 4: Completion Handoff

Present the not-met obligations to the person and let them decide. Do not change
the requirements in this stage.

## Sensors

Required-sections check on `conformance-report.md`.

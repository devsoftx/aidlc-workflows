# Operate Phase -- Stage Reference (7.1-7.3)

## Phase Overview

Operate is the seventh and last of the phases in the AI-DLC lifecycle. It
follows Deploy and sets up how the delivered software is watched, how incidents
are handled, and how operational feedback feeds the next iteration. It has
three stages, numbered 7.1 through 7.3, and all three are CONDITIONAL:

- Observability Setup (7.1) runs when monitoring, dashboards, alarms or tracing
  need configuring.
- Incident Response (7.2) runs when operational runbooks and incident response
  procedures are needed.
- Feedback & Optimization (7.3) runs when ongoing operational monitoring and
  optimization are needed.

All three are led by `aidlc-operations-agent`. Feedback & Optimization also has
`aidlc-aws-platform-agent` as a support agent when collaborators are on.

Support agents take part only when collaborators are on (the `collaborators`
setting, shipped on only for `enterprise`; `/aidlc --collaborators on` turns it
on for one piece of work). With collaborators off, the engine hands each stage
an empty `support_agents` list and the lead runs alone.

## Stage Summary Table

| Stage | Name | Condition | Lead Agent | Support Agents | Mode |
|-------|------|-----------|------------|----------------|------|
| 7.1 | Observability Setup | CONDITIONAL | `aidlc-operations-agent` | -- | inline |
| 7.2 | Incident Response | CONDITIONAL | `aidlc-operations-agent` | -- | inline |
| 7.3 | Feedback & Optimization | CONDITIONAL | `aidlc-operations-agent` | `aidlc-aws-platform-agent` | inline |

## Scope Applicability

The compiled grid (`EXECUTE` in `scope-grid.json`) lists the Operate stages each
scope plans:

| Scope | Stages that run |
|-------|-----------------|
| bugfix | none |
| classic | none |
| enterprise | 7.1, 7.2, 7.3 |
| express | 7.1 |
| feature | 7.1, 7.2, 7.3 |
| infra | 7.1 |
| mvp | none |
| poc | none |
| refactor | none |
| security-patch | none |
| workshop | 7.1, 7.2, 7.3 |

The full compiled plan for `express` ends with the Operate stage it plans, after
the Deploy stages:

```text
$ aidlc engine graph scope express
workspace-scaffold
workspace-detection
state-init
reverse-engineering
requirements-analysis
code-generation
build-and-test
code-review
security-review
deployment-pipeline
deployment-execution
observability-setup
```

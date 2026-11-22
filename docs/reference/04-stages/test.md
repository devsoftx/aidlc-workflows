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

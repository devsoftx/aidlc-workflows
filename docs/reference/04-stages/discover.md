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

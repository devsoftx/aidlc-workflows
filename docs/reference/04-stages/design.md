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
produces the detailed execution plan for Build and Operate.

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

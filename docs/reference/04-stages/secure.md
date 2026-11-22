# Secure Phase -- Stage Reference (5.1-5.3)

## Phase Overview

Secure is the fifth of the seven phases in the AI-DLC lifecycle. It follows Test
and reviews the built code before it is deployed. It has three stages, numbered
5.1 through 5.3.

Code Review (5.1) is an ALWAYS stage that runs once after Build and Test, and it
covers every unit's code. Security Review (5.2) is an ALWAYS stage that runs
after Code Review. It covers authentication, authorization, data handling,
secrets, dependencies and infrastructure. Conformance Review (5.3) is
CONDITIONAL: it runs when the project has written requirements, standards or
regulatory obligations that the delivered code must meet.

[Deploy](deploy.md) follows Secure.

## Stage Summary Table

| Stage | Name | Condition | Lead Agent | Support Agents | Mode |
|-------|------|-----------|------------|----------------|------|
| 5.1 | Code Review | ALWAYS | `aidlc-quality-agent` | -- | inline |
| 5.2 | Security Review | ALWAYS | `aidlc-devsecops-agent` | -- | inline |
| 5.3 | Conformance Review | CONDITIONAL | `aidlc-compliance-agent` | -- | inline |

## Scope Applicability

The compiled grid (`EXECUTE` in `scope-grid.json`) lists the Secure stages each
scope plans:

| Scope | Stages that run |
|-------|-----------------|
| bugfix | 5.1, 5.2 |
| classic | 5.1, 5.2, 5.3 |
| enterprise | 5.1, 5.2, 5.3 |
| express | 5.1, 5.2 |
| feature | 5.1, 5.2 |
| infra | 5.1, 5.2, 5.3 |
| mvp | 5.1, 5.2 |
| poc | 5.1, 5.2 |
| refactor | 5.1, 5.2 |
| security-patch | 5.1, 5.2, 5.3 |
| workshop | 5.1, 5.2 |

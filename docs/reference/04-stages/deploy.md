# Deploy Phase -- Stage Reference (6.1-6.4)

## Phase Overview

Deploy is the sixth of the seven phases in the AI-DLC lifecycle. It follows
Secure and prepares the pipelines and environments the software is delivered
through, then executes the deployment. It has four stages, numbered 6.1 through
6.4, and all four are CONDITIONAL:

- CI Pipeline (6.1) runs when the CI pipeline needs creating or significant
  modification.
- Deployment Pipeline (6.2) runs when the CD pipeline needs creating or
  significant modification.
- Environment Provisioning (6.3) runs when AWS environments need provisioning or
  validation.
- Deployment Execution (6.4) runs once the deployment pipeline and the
  environment are ready.

Support agents take part only when collaborators are on (the `collaborators`
setting, shipped on only for `enterprise`; `/aidlc --collaborators on` turns it
on for one piece of work). With collaborators off, the engine hands each stage
an empty `support_agents` list and the lead runs alone.

## Stage Summary Table

| Stage | Name | Condition | Lead Agent | Support Agents | Mode |
|-------|------|-----------|------------|----------------|------|
| 6.1 | CI Pipeline | CONDITIONAL | `aidlc-pipeline-deploy-agent` | -- | inline |
| 6.2 | Deployment Pipeline | CONDITIONAL | `aidlc-pipeline-deploy-agent` | -- | inline |
| 6.3 | Environment Provisioning | CONDITIONAL | `aidlc-aws-platform-agent` | `aidlc-devsecops-agent`, `aidlc-compliance-agent` | inline |
| 6.4 | Deployment Execution | CONDITIONAL | `aidlc-pipeline-deploy-agent` | `aidlc-developer-agent` | inline |

## Scope Applicability

The compiled grid (`EXECUTE` in `scope-grid.json`) lists the Deploy stages each
scope plans:

| Scope | Stages that run |
|-------|-----------------|
| bugfix | 6.2, 6.4 |
| classic | none |
| enterprise | 6.1, 6.2, 6.3, 6.4 |
| express | 6.2, 6.4 |
| feature | 6.1, 6.2, 6.3, 6.4 |
| infra | 6.1, 6.2, 6.3, 6.4 |
| mvp | 6.1 |
| poc | none |
| refactor | 6.2, 6.4 |
| security-patch | 6.2, 6.4 |
| workshop | 6.1, 6.2, 6.3, 6.4 |

[Operate](operate.md) follows Deploy.

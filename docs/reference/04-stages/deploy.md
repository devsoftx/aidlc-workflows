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

---

## Stage 6.1: CI Pipeline

### Metadata

| Property          | Value                                                                                             |
|-------------------|---------------------------------------------------------------------------------------------------|
| Stage             | 6.1                                                                                               |
| Phase             | Deploy                                                                                      |
| Execution         | CONDITIONAL (skip if CI already exists and is adequate)                                           |
| Condition         | Execute when CI pipeline needs creation or significant modification                               |
| Per-Unit          | No (runs once for all units)                                                                     |
| Lead Agent        | aidlc-pipeline-deploy-agent                                                                             |
| support_agents    | (none)                                                                                            |
| mode              | inline                                                                                            |
| Inputs            | Code generation output from Stage 3.1, build/test results from Stage 4.1                         |
| Outputs           | `<record>/deploy/ci-pipeline/` -- ci-config.md, quality-gates.md, ci-pipeline-questions.md |

### Purpose

Configure the CI (Continuous Integration) pipeline with quality gates,
artifact management, and build/test automation. The aidlc-pipeline-deploy-agent
leads with no support agents.

### Inputs

- Build/test results from `<record>/test/build-and-test/`
- Infrastructure design from `<record>/design/infrastructure-design/`
  (if exists)
- Workspace profile for existing CI configuration

### Steps

1. **Load Prior Context** -- Read build/test results, infrastructure design
   (if exists), and workspace profile for existing CI configuration.

2. **Generate Clarifying Questions** -- Create
   `<record>/deploy/ci-pipeline/ci-pipeline-questions.md` with
   questions:
   - What CI tool is in use (CodePipeline, CodeBuild, GitHub Actions,
     Jenkins)?
   - What is the branch strategy?
   - What quality gates are required before merge?
   - What artifact repositories are used (ECR, CodeArtifact, S3)?

   Follow stage-protocol.md question flow.

3. **Collect and Analyze Answers** -- Validate CI choices against existing
   infrastructure and team capabilities.

4. **Generate Artifacts** -- Create CI pipeline configuration (buildspec.yml,
   workflow YAML, or equivalent), quality gate definitions, and artifact
   repository configuration.

5. **Phase Boundary Verification** -- Run the Build phase boundary
   verification check:
   - Architecture-to-code-to-tests alignment
   - All code traces to design
   - Test coverage against acceptance criteria
   - Write results to `<record>/verification/phase-check-build.md`

6. **Prepare Completion** -- Verify the CI and boundary artifacts. Do not
   edit stage or phase state; the reported gate outcome owns the transition.

7. **Completion** -- Present completion message and approval gate.

### Outputs

| Artifact                  | Description                                              |
|---------------------------|----------------------------------------------------------|
| ci-config.md              | CI pipeline configuration (buildspec, workflow YAML, etc.) |
| quality-gates.md          | Quality gate definitions for merge/promotion             |
| ci-pipeline-questions.md  | Clarifying questions with answers                        |

### Approval Gate

Strictly 2-option: Approve / Request Changes.

### Notes

- **Phase boundary verification**: This stage carries the Build phase boundary
  verification check, validating that architecture traces
  to code and code traces to tests. Results are written to
  `<record>/verification/phase-check-build.md`.
- **Conditional execution**: This stage is skipped if the project already has
  an adequate CI pipeline. The plan (the scope, plus any skip or add the person
  makes) decides whether it is reached, and the stage still applies its own
  condition; Delivery Planning plans the Bolts, not the stages.
- **Post-unit execution**: Like Stage 4.1, this stage runs once after all
  per-unit work is complete, not per-unit.


---
name: mvp
depth: Standard
keywords:
  - mvp
  - minimum viable
description: Skip operations, ship the core
skeleton: on
runner: true
guard_policy: off
sensors: on
learnings: on
summary_confirmation: on
plan_approval: on
collaborators: off
---

# mvp scope

Standard depth, but trims the front and back of the workflow to ship the
core fast. Discover runs a reduced ceremony (no market-research, no
team-formation, no approval-handoff) and the production stages (Performance
Validation and every Deploy and Operate stage but CI Pipeline) are skipped — an
MVP proves the product, it does not yet carry production
operations weight.

Guard Policy defaults to off: changed inputs are recorded and announced, the run continues, and plan approval, review freeze, state transition, and reviewer read scope are lowered for undirected work. Human presence stays up.

## Why these stages, why skip those

The full design pass and the unit loop stay EXECUTE: an MVP is still
real software that needs design, code, and tests. What it skips is the
discovery overhead that only pays off at scale (market-research,
team-formation) and the production stages (deployment-pipeline,
environment-provisioning, deployment-execution, observability-setup,
incident-response, performance-validation, feedback-optimization), which
belong to a product past its first proof. Promote to `feature` or
`enterprise` when the MVP graduates.

## Membership

Keyword triggers: `mvp`, `minimum viable`. Initialization, the reduced
discover set, all of design, the build path of the unit loop
(code-generation, build-and-test), code-review, security-review, and
ci-pipeline run; performance-validation, conformance-review, the other
deploy stages, and all of operate are skipped.

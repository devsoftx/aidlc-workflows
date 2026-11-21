---
name: workshop
depth: Standard
testStrategy: Minimal
keywords:
  - workshop
  - lab
  - training
description: Facilitated group session with mandatory gates
skeleton: on
review_cap: advisory
guard_policy: off
sensors: on
learnings: on
summary_confirmation: on
plan_approval: on
collaborators: off
---

# workshop scope

Standard depth for a facilitated group session with mandatory gates, but
with a Minimal test strategy - the `testStrategy` override that keeps the
test floor light for a teaching context. It runs the design,
the unit loop, and deploy and operate arc end to end (so participants see the whole
lifecycle) while skipping the early discover stages that a facilitator
front-loads by hand.

Guard Policy defaults to off: moved inputs are reported once and plan approval, review freeze, state transition, and reviewer read scope are lowered for undirected work; human presence stays up, and a facilitator who wants approvals reopened and every fence up sets strict.

## Why these stages, why skip those

A workshop walks a group through the methodology, so it keeps the
substantive build and operate stages visible: reverse-engineering,
practices-discovery, the full design pass, the unit loop, and the
deploy and operate phases all run. It skips the early discover ceremony
(market-research, feasibility, scope-definition, team-formation,
rough-mockups, approval-handoff) because the facilitator scopes the
exercise up front rather than running those stages live. The
`testStrategy: Minimal` override means tests are demonstrated, not held to
the production floor.

## Membership

Keyword triggers: `workshop`, `lab`, `training`. Initialization, the
design set, reverse-engineering, all of the unit loop, and all of deploy and operate execute; the
other discover stages are SKIP.

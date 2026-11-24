---
name: classic
depth: Standard
keywords: []
description: "V1-style ceremony through Design and the unit loop - the implicit default"
skeleton: off
review_cap: advisory
guard_policy: off
sensors: on
learnings: on
summary_confirmation: off
plan_approval: on
collaborators: off
---

# classic scope

`classic` is the implicit default scope - used when neither the user nor
`AWS_AIDLC_DEFAULT_SCOPE` names one - and restores v1-style ceremony through
Design and the unit loop: one human approval for reverse-engineering and for each Design stage before the unit loop. In
the unit loop, built Unit by Unit, the human approves each Unit's code plan and,
under "Review each checkpoint", its checkpoint, so a Unit's design stages run
without a stop of their own; team-owned Units keep their own per-stage or
end-of-Unit gates. Discover is skipped except reverse-engineering, and Deploy and Operate remain a placeholder. Stage-declared execution modes
are unchanged; collaborators are off, so each stage runs with its lead agent
only (`/aidlc --collaborators on` brings the support agents in).

Guard Policy defaults to off: changed inputs are recorded and announced in one line, and plan approval, review freeze, state transition, and reviewer read scope are lowered for undirected work. Human presence stays up.

Reviews are advisory: one pass per stage whose findings reach the human at
the approval gate, with no refute-and-repair loop; explicit autonomy keeps the
single pre-merge review. Walking-skeleton ceremony and summary confirmation
are off. Sensors run and the learnings ritual runs. Under off, Plan Approval,
review freeze, state transition, and reviewer read scope stand aside for
undirected work and record a `GUARD_STOOD_ASIDE` row each time; the approval
question is still asked by the conductor. Human-turn authority and audit remain
in force.

Override ceremonies per intent with `/aidlc --sensors on|off`,
`/aidlc --learnings on|off`, `/aidlc --summary-confirmation on|off`, and
`/aidlc --collaborators on|off`. The global kill switches
`AIDLC_DISABLE_SENSORS=1`, `AIDLC_DISABLE_LEARNINGS=1`,
`AIDLC_DISABLE_SUMMARY_CONFIRMATION=1`, and `AIDLC_DISABLE_COLLABORATORS=1`
force their ceremony off even when the intent says on; they can also be
recorded with `aidlc config flags --bypass <NAME>`.

## Why these stages, why skip those

AI-DLC v1 had no Discover phase, so `classic` skips the seven discover stages except reverse-engineering.
It keeps reverse-engineering, all Design stages, Code Generation, Build and Test, and the
three Secure reviews. Performance Validation and every Deploy and Operate stage (CI Pipeline
among them) are skipped: customers bring their own CI and downstream, and Build and Test is the one integrated build
across every unit. Only ten stages are unconditional: the three Initialization stages,
Requirements Analysis, Units Generation, Delivery Planning, Code Generation,
Build and Test, Code Review, and Security Review. The remaining Design and
per-unit work, and Conformance Review, are CONDITIONAL and self-select from project context, preserving v1's adaptive behavior.

Its test strategy inherits Standard from its depth, so production testing
expectations remain in force. The separate `workshop` scope retains the
teaching-oriented Minimal test override for existing workshop workflows.

## Membership

Initialization, reverse-engineering, every Design stage, Code Generation, Build and Test,
and the three Secure reviews are in the grid: 18 of the 33 stages after Initialization.
The other seven Discover stages, Performance Validation, and every Deploy and Operate
stage are SKIP. The scope intentionally has no keywords; name it explicitly
or use the implicit default.

# Secure Phase Guardrails

These rules apply to every stage whose `phase: secure` declaration
imports them as the matching phase rule.

## Code Review

- Every changed file is reviewed for correctness, error handling and maintainability
- Findings name the file, the severity and a concrete fix

## Security Review

- Check authentication, authorization, input validation, secrets handling and dependencies on every entry point
- Blocking security findings stop the run until the person decides on each one

## Conformance Review

- Each written requirement, standard or regulatory obligation is marked met, partly met or not met, with evidence
- Not-met obligations are reported as deployment blockers, never silently accepted

## Corrections

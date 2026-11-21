# Test Phase Guardrails

These rules apply to every stage whose `phase: test` declaration
imports them as the matching phase rule.

## Testing Standards

- Test files must cover the happy path and at least two error/edge cases
- Tests must be runnable without manual setup beyond documented prerequisites
- Do not generate tests that always pass regardless of implementation (e.g., `assert True`)

## Traceability

- Every test result must name the requirement, story, or unit it verifies
- Report failing tests with their cause; do not mark a stage complete with unexplained failures

## Corrections

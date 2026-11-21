# Deploy Phase Guardrails

These rules apply to every stage whose `phase: deploy` declaration
imports them as the matching phase rule.

## Infrastructure Safety

- Infrastructure changes require security review — document the security implications of every change
- Never remove or bypass existing security controls without explicit approval and documented rationale
- Changes to IAM roles, network policies, or encryption settings must include a risk assessment

## Deployment Procedures

- All deployment procedures must include rollback steps — document how to reverse every change
- Deployments to production must have a defined smoke test or health check to verify success
- Blue/green or canary strategies must document traffic-shifting criteria and abort conditions

## Corrections

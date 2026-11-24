# Operate Phase Guardrails

These rules apply to every stage whose `phase: operate` declaration
imports them as the matching phase rule.

## Observability

- SLOs must be quantified with specific percentages and time windows (e.g., "99.9% availability over a 30-day rolling window")
- Alerting thresholds must be set below SLO breach to allow time for remediation
- Every new service or component must have at least one health metric and one error rate metric

## Incident Response

- Runbooks must include escalation paths and contact information
- Post-incident reviews are required for any P1/P2 incident — document timeline, root cause, and prevention

## Corrections

# DevSecOps Agent

> **Agent deep dive** · [User Guide](../00-introduction.md) › [Agents](../06-agents.md) › [deep dives](README.md) · Technical reference: [devsecops-agent](../../reference/agents/devsecops-agent.md)

The aidlc-devsecops-agent is your security engineer. It ensures that security is embedded into every phase of the lifecycle rather than bolted on at the end. It takes compliance requirements identified in Discover and implements them as security controls, threat models, scanning pipelines, and runtime monitoring. It covers application security, cloud security, and pipeline security.

The aidlc-devsecops-agent leads one stage, Security Review in the Secure phase, where it checks the built code and infrastructure for security weaknesses. It also contributes security expertise to five stages spanning Design, Test, and Deploy. It has Bash access for running security scanning tools.

## Stages Led

| Stage | Phase | Description |
|-------|-------|-------------|
| 5.2 Security Review | Secure | Maps the attack surface and checks authentication, authorization, data handling, secrets, dependencies and infrastructure settings; lists the findings that block deployment |

## Stages Supported

| Stage | Phase | Contribution |
|-------|-------|-------------|
| 2.1 Practices Discovery | Design | Mutually blind security-practice spoke when collaborators are on; writes its own contribution file |
| 2.10 NFR Requirements | Design | Security controls, threat model, STRIDE analysis |
| 2.12 Infrastructure Design | Design | IAM policy review, security group validation |
| 4.1 Build and Test | Test | SAST/DAST scans, dependency vulnerabilities, IaC linting |
| 6.3 Environment Provisioning | Deploy | Security posture validation (Security Hub, Inspector, GuardDuty) |

## What to Expect

When the aidlc-devsecops-agent is active (leading Security Review, or as a supporting agent alongside another stage's lead), it focuses on attack surfaces, trust boundaries, and security controls. It reviews designs for security anti-patterns, validates that sensitive data flows are encrypted and access-controlled, and assesses third-party dependencies for known vulnerabilities.

## How It Collaborates

The aidlc-devsecops-agent receives regulatory requirements from the aidlc-compliance-agent and system designs from the aidlc-architect-agent. It works with the aidlc-developer-agent on secure coding practices, the aidlc-aws-platform-agent on infrastructure hardening, and the aidlc-quality-agent on security test requirements. Its security gates and scanning configurations are handed off to the aidlc-pipeline-deploy-agent.

## Key Principles

- Defense in depth — no single security control should be a single point of failure
- Least privilege everywhere — minimum permissions for every user, service, and process
- Assume breach — internal components must authenticate and authorize each other
- Default configurations must be secure
- All input is hostile until validated; all external data is tainted until sanitized
- Security is a requirement, not a feature that can be deferred

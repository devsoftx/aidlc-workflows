# Compliance Agent

> **Agent deep dive** · [User Guide](../00-introduction.md) › [Agents](../06-agents.md) › [deep dives](README.md) · Technical reference: [compliance-agent](../../reference/agents/compliance-agent.md)

The aidlc-compliance-agent is your GRC (Governance, Risk, and Compliance) analyst. It ensures that every stage of the lifecycle accounts for applicable regulatory obligations and organizational compliance policies. It scans for regulatory requirements early, maps them to technical controls, maintains the RAID log for compliance risks, and validates that designs meet audit expectations.

The aidlc-compliance-agent leads one stage, Conformance Review in the Secure phase, where it checks the delivered code against the project's written obligations. It also contributes compliance expertise to four stages spanning Discover, Design, and Deploy.

## Stages Led

| Stage | Phase | Description |
|-------|-------|-------------|
| 5.3 Conformance Review | Secure | Checks the delivered code, tests and deployment settings against the requirements, rules and regulatory obligations; each obligation not met is a blocker for deployment |

## Stages Supported

| Stage | Phase | Contribution |
|-------|-------|-------------|
| 1.3 Feasibility & Constraints | Discover | Regulatory constraint identification, compliance feasibility, RAID log initialization |
| 2.10 NFR Requirements | Design | Regulatory NFR mapping, compliance control requirements, data classification |
| 2.12 Infrastructure Design | Design | Data residency validation, encryption requirements, IAM compliance controls |
| 6.3 Environment Provisioning | Deploy | Compliance controls validation, audit logging, regulatory configuration checks |

## What to Expect

When the aidlc-compliance-agent is active (leading Conformance Review, or as a supporting agent alongside another stage's lead), it focuses on regulatory frameworks, data classification, and control mapping. It asks about applicable regulations (GDPR, HIPAA, PCI-DSS, SOC 2), data sensitivity levels, and existing compliance policies. It produces compliance control matrices and flags gaps that need remediation.

## How It Collaborates

The aidlc-compliance-agent receives system designs and data flow information from the aidlc-architect-agent, and security control details from the aidlc-devsecops-agent. It provides compliance requirements and constraints back to the aidlc-architect-agent for design incorporation, and security control specifications to the aidlc-devsecops-agent for implementation.

## Key Principles

- Compliance is a constraint, not an afterthought — gaps discovered at release are project failures
- Data classification drives every control decision
- Compliance claims require auditable evidence — a control without proof does not exist
- Focus remediation on the highest-sensitivity data and highest-penalty regulations
- Regulatory literacy is a team sport — the aidlc-compliance-agent educates, the team executes

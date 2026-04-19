# Proposal Template

Canonical structure for the `proposal-writer` skill. Every generated proposal follows this outline. Sections may be renamed to match the customer's language but the content spine does not change.

---

# Cover

**Prepared for**: [Customer Legal Name]
**Prepared by**: [Our Legal Name]
**Proposal title**: [e.g. "Real-Time Personalization Platform Implementation"]
**Date**: YYYY-MM-DD
**Version**: 1.0
**Validity**: This proposal is valid for 30 days from the date above.

**Primary contacts**:
- Customer: [Name, Title, Email]
- Us: [Name, Title, Email, Phone]

**Confidentiality**: This document is shared under the terms of the mutual NDA dated [YYYY-MM-DD].

---

# 1. Executive Summary

Three to four paragraphs. Stands alone — an executive reading only this page must understand the situation, the solution, and the outcome.

- **Paragraph 1**: Their situation, using their language, anchored to one metric they care about.
- **Paragraph 2**: What we propose — product, scope, duration — named concretely.
- **Paragraph 3**: The quantified outcome, tied to a named case study.
- **Paragraph 4** (optional): The commercial frame — investment range and timing.

---

# 2. Our Understanding of Your Situation

Bulleted summary of the customer's stated context. Sourced entirely from discovery notes. Use their language, their numbers, their team names.

**Business context**:
- [Statement of where the company is, e.g. "Acme Retail is targeting $75M in 2026 revenue, with repeat purchase rate as the primary growth lever."]

**Current state**:
- [Current stack, e.g. "Shopify Plus, Klaviyo, NetSuite, Snowflake as data warehouse."]
- [Current process, e.g. "Personalization today is driven by weekly batch exports to Klaviyo."]

**Stated pain points**:
- [Verbatim pain, e.g. "No real-time view of customer behavior across channels."]
- [...]

**Desired outcomes**:
- [Outcome with metric, e.g. "5% lift in repeat-purchase rate within 90 days of go-live."]
- [...]

**Constraints**:
- [Timeline constraint, budget, compliance, staffing, technical.]

---

# 3. Proposed Approach

Organized by their requirements, not by our product modules.

### 3.1 [Requirement 1 — in their words]

- **Our solution**: [feature/module/service that addresses it].
- **Why this works**: [1-2 sentences of rationale].
- **What it looks like**: [concrete description — "real-time event stream with <2s latency from browser to Klaviyo"].

### 3.2 [Requirement 2 — in their words]

...

### 3.3 [Requirement 3 — in their words]

...

If any requirement cannot be met, say so here explicitly and propose an alternative or a phase-2 plan.

---

# 4. Scope

### In scope

1. [specific deliverable — "Identity resolution across Shopify, Klaviyo, and NetSuite using email as primary key with fallback to hashed phone"]
2. [...]
3. [...]

### Out of scope

1. [explicit exclusion — "Paid-media audience sync to Meta and Google Ads"]
2. [...]

Out-of-scope is non-negotiable at this stage. Expansion requires a Change Order.

---

# 5. Deliverables

Each deliverable has an acceptance criterion.

| # | Deliverable | Acceptance criterion | Owner |
|---|---|---|---|
| 1 | [e.g. Snowflake integration] | [e.g. Three target tables synced with end-to-end latency <2s on 95th percentile] | [Us / Customer / Joint] |
| 2 | [e.g. Homepage personalization surface] | [e.g. Variant served within 500ms for logged-in users; A/B framework returns significance within 14 days] | |
| 3 | [...] | [...] | |

---

# 6. Timeline

Phased delivery. Each phase has start, end, milestones, and customer dependencies.

### Phase 0 — Kickoff (Week 0)
- Kickoff meeting, access provisioning, project-management setup.
- **Milestone**: signed SOW, provisioned access.
- **Customer dependency**: named PM, SSO access to 3 named systems.

### Phase 1 — Foundation (Weeks 1-4)
- Identity resolution, data model, event pipeline.
- **Milestone M1**: end-to-end event flow live in staging.
- **Customer dependency**: Snowflake credentials, Shopify app install.

### Phase 2 — Rollout (Weeks 5-8)
- Personalization surfaces live one-by-one.
- **Milestone M2**: homepage live in production with 5% traffic.
- **Milestone M3**: 100% traffic, all three surfaces live.
- **Customer dependency**: content variants from marketing team.

### Phase 3 — Optimization (Weeks 9-10)
- Measurement, dashboards, enablement.
- **Milestone M4**: customer-facing dashboard signed off.
- **Customer dependency**: analytics counterpart available for 2 working sessions.

---

# 7. Investment

| Item | Year 1 | Year 2 | Year 3 |
|---|---|---|---|
| Platform license (seats / volume / tier) | $X | $Y | $Z |
| Implementation (one-time) | $X | — | — |
| Professional services | $X | $Y | $Z |
| Training & enablement | $X | — | — |
| **Annual total** | **$X** | **$Y** | **$Z** |

**List vs. effective**: [show list price, discount %, effective price if applicable.]
**Payment terms**: [Net 30 upon signature; annual upfront; etc.]
**Price protection**: [any cap on year-over-year increase.]

---

# 8. Assumptions

This proposal assumes the following. Material changes may require scope/price adjustment.

1. Customer provides a named project manager at 50% allocation for the duration.
2. SSO (Okta, Azure AD, or SAML-compliant IdP) is already configured and accessible for integration.
3. Customer's data warehouse is accessible from our managed VPC; customer provides a service account with read access to the 3 named schemas.
4. Content variants for personalization surfaces are provided by the customer's marketing team no later than Week 3.
5. All user acceptance testing is completed within 5 business days of a phase milestone being handed over.

---

# 9. Our Team

Named individuals, real bios. No placeholders.

- **[Name] — Engagement Manager**. [Tenure], [1 sentence relevant experience, e.g. "Led implementation for Warby Parker's omnichannel CDP rollout in 2024."]
- **[Name] — Solutions Architect**. [...]
- **[Name] — Customer Success Lead**. [...]
- **[Name] — Executive Sponsor**. [...]

---

# 10. Case Studies

Two to three named case studies, comparable in vertical and/or scale.

### Case Study 1 — [Customer name]

- **Situation**: [1-2 sentences].
- **Solution**: [1-2 sentences].
- **Outcome**: [quantified: "6.2% lift in repeat purchase rate in first 90 days."]
- **Reference**: Available on request.

### Case Study 2 — [Customer name]

...

### Case Study 3 — [Customer name]

...

---

# 11. Next Steps

Concrete actions with owners and dates.

| # | Action | Owner | Date |
|---|---|---|---|
| 1 | Review proposal internally | [Customer champion] | [date] |
| 2 | Commercial review call | [Us + Customer procurement] | [date] |
| 3 | Legal review of MSA / SOW | [Both legal teams] | [date] |
| 4 | Countersignature | [Customer signatory] | [date] |
| 5 | Kickoff meeting | [Both teams] | [date] |

---

# 12. Terms & Conditions

This proposal is governed by the Master Services Agreement dated [YYYY-MM-DD] (or the draft MSA attached as Appendix A). The Statement of Work incorporated in Section 4 (Scope), Section 5 (Deliverables), and Section 6 (Timeline) forms part of the governing agreement upon countersignature.

Standard clauses referenced:
- Data Processing Agreement (DPA) — GDPR and CCPA compliant.
- Information Security Schedule — SOC 2 Type II, ISO 27001.
- Service Level Agreement — 99.9% uptime, incident response SLAs per tier.

---

# Appendix

- **A.** MSA draft (if no MSA in place).
- **B.** Security and compliance summary.
- **C.** Reference architecture diagram.
- **D.** Detailed feature list of proposed tier.
- **E.** Glossary of terms.

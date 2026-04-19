# Severity Thresholds

This reference defines how findings are triaged and the remediation SLAs the
`security-audit` and `pentest-report` skills apply. It is based on CVSS 3.1
base scores, adjusted for exposure context.

## CVSS 3.1 base-score matrix

| Severity | CVSS 3.1 range | Typical meaning                                                                 |
|----------|----------------|----------------------------------------------------------------------------------|
| Critical | 9.0 – 10.0     | Unauthenticated RCE, full auth bypass, mass data exfiltration, key material leak. |
| High     | 7.0 – 8.9      | Privileged RCE, authenticated SQLi with PII access, SSRF to metadata endpoint.   |
| Medium   | 4.0 – 6.9      | Stored XSS in an admin-only view, IDOR with limited blast radius, CSRF on writes. |
| Low      | 0.1 – 3.9      | Information disclosure with no PII, verbose error pages, missing cache headers.   |
| None     | 0.0            | Informational / hygiene finding.                                                 |

## Remediation SLAs

SLAs start at the time the finding is confirmed (triage complete, not scanner
emission time).

| Severity | Fix SLA (internet-facing) | Fix SLA (internal only) | Mitigation required within |
|----------|---------------------------|--------------------------|----------------------------|
| Critical | 24 hours                  | 72 hours                 | Immediate (block release)  |
| High     | 7 days                    | 14 days                  | 48 hours                   |
| Medium   | 30 days                   | 60 days                  | 14 days                    |
| Low      | 90 days                   | next release             | Backlogged, tracked        |

"Mitigation" means a compensating control (WAF rule, feature flag off, network
ACL) is in place even if the code fix is still in progress.

## Context adjustments

CVSS base scores are rarely sufficient. Apply these adjustments before
assigning the final severity:

1. **Internet-facing vs internal.** An authenticated SQLi on an internal
   admin panel behind a VPN is typically downgraded one level (High -> Medium).
   The same SQLi on the public marketing site is upgraded one level.
2. **Data classification.** Finding that touches regulated data (PII, PHI,
   cardholder, auth secrets) never drops below High regardless of CVSS.
3. **Blast radius.** A single-tenant bug in a multi-tenant service is upgraded
   one level.
4. **Exploit availability.** If a working public exploit or Metasploit module
   exists, upgrade one level (and compress SLA to the next tighter band).
5. **Authentication prerequisite.** Unauthenticated RCE is always Critical.
   Authenticated RCE behind SSO with MFA may be High in internal contexts.

## What "Critical" means by context

- **Perimeter service (API gateway, edge cache, auth service):** any
  unauthenticated code execution, session fixation, JWT confusion, or cache
  poisoning -> Critical.
- **Internal service (service-to-service):** only findings that enable
  lateral movement across tenants, or credential theft usable at the
  perimeter, are Critical.
- **Data store (DB, object store, KMS):** any path to unauthenticated
  read of another tenant's data, any path to key export -> Critical.
- **Build/CI pipeline:** any path to arbitrary code execution on a runner
  with production credentials -> Critical (supply-chain risk).
- **Client SDK / mobile app:** any path to bypass certificate pinning or
  extract long-lived credentials -> Critical.

## Auto-downgrade rules

The normalizer in `security-audit` applies these deterministic downgrades
before report emission:

- Finding is in `/test/`, `/tests/`, `/e2e/`, `/__fixtures__/`, or `/examples/`
  -> drop one severity level and mark `context: test-asset`.
- Finding is a known false-positive listed in `.security-audit-allowlist.yaml`
  -> drop to `informational` and flag `allowlisted: true` with a required
  justification reference.
- Finding rule ID matches `generic.secrets.*` but hits only a `.env.example`
  with placeholder values (`REPLACE_ME`, `changeme`, `xxxxx`) -> drop.

## Gating policy

The `security-audit` skill returns non-zero when:

- Any Critical is present, OR
- More than 3 High findings in internet-facing components, OR
- Any finding with a known public exploit AND CVSS >= 7.0.

Teams wanting a softer gate should override `SEVERITY_FLOOR` and the
`FAIL_ON_CRITICAL` env var rather than editing this file.

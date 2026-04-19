---
name: container-scan
description: Use when the user asks to "scan this container", before a registry push, or as a release gate for a Docker/OCI image. Runs Trivy image + filesystem + secret scans, verifies distroless/non-root user, checks Dockerfile best practices, and blocks on Critical/High CVEs.
safety: safe
---

## When to use

Trigger on any of:

- "Scan this Docker image before I push."
- "Is `ghcr.io/acme/api:1.14.2` safe to ship?"
- Pre-release gate: CI job that builds an image and needs a pass/fail.
- Investigating a base-image upgrade ("did alpine:3.19 clear the openssl CVE?").

Do not use for running-container runtime monitoring (that is Falco/EDR
territory) or for dependency scanning of the source tree pre-build (use
`dependency-audit`).

## Inputs

- `IMAGE` — OCI reference to scan, e.g. `ghcr.io/acme/api:1.14.2` or a local
  tag `api:dev`. Required unless `DOCKERFILE` is given.
- `DOCKERFILE` (optional) — path to a Dockerfile to lint and scan.
- `CONTEXT` (optional) — build context when `DOCKERFILE` is provided.
- `OUT_DIR` (default: `./container-scan-out`).
- `FAIL_ON` (default: `CRITICAL,HIGH`) — severities that cause non-zero exit.
- `IGNORE_UNFIXED` (default: `0`) — Trivy `--ignore-unfixed`.
- Optional env:
  - `TRIVY_CACHE_DIR` — share vulnerability DB across runs.
  - `TRIVY_IGNOREFILE` — path to `.trivyignore`.

## Outputs

- `trivy-image.json` — Trivy CVE scan of the image.
- `trivy-secret.json` — secrets found in image layers.
- `trivy-config.json` — Dockerfile / IaC misconfiguration scan.
- `hadolint.json` — Dockerfile lint (if `DOCKERFILE` provided).
- `image-inspect.json` — `docker inspect` output.
- `container-scan-report.md` — human summary with pass/fail gates.

## Tool dependencies

- `trivy` >= 0.50 (https://aquasecurity.github.io/trivy/).
- `docker` or `podman` (for `image inspect` and saving images).
- `hadolint` >= 2.12 (optional; auto-skipped if missing).
- `jq`.
- `syft` (optional) for SBOM generation.

## Procedure

1. Validate inputs. If `IMAGE` not provided and `DOCKERFILE` is, build
   first: `docker build -t scan-target:tmp -f "$DOCKERFILE" "$CONTEXT"`.
2. Pull the image if remote:
   `docker pull "$IMAGE"` (or `podman pull`).
3. Inspect:
   `docker image inspect "$IMAGE" > "$OUT_DIR/image-inspect.json"`.
   Parse `Config.User`, `Config.ExposedPorts`, `RootFS.Layers`,
   `History[].CreatedBy`.
4. Trivy vulnerability scan:
   ```
   trivy image \
     --format json --output "$OUT_DIR/trivy-image.json" \
     --severity CRITICAL,HIGH,MEDIUM,LOW \
     --vuln-type os,library \
     --scanners vuln \
     ${IGNORE_UNFIXED:+--ignore-unfixed} \
     "$IMAGE"
   ```
5. Trivy secret scan (examines each layer):
   ```
   trivy image --scanners secret \
     --format json --output "$OUT_DIR/trivy-secret.json" "$IMAGE"
   ```
6. Trivy config scan (Dockerfile + embedded IaC):
   ```
   trivy config --format json --output "$OUT_DIR/trivy-config.json" \
     ${DOCKERFILE:+"$(dirname "$DOCKERFILE")"} \
     ${DOCKERFILE:-"$IMAGE"}
   ```
7. If `DOCKERFILE` provided, run hadolint:
   `hadolint --format json "$DOCKERFILE" > "$OUT_DIR/hadolint.json"`.
8. Best-practice checks against `image-inspect.json`:
   - `Config.User` must be non-empty and not `root` / `0` (else FAIL).
   - `RootFS.Layers` count should be <= 20 (advisory).
   - Base image SHOULD be distroless, Chainguard Wolfi, or `*-slim` —
     heuristic: missing `/bin/sh`, `/bin/bash`, or no shell in manifest.
   - No `ADD http://` URLs in history (use `COPY` + verified artefact).
   - No secrets in `Config.Env` (cross-check against `trivy-secret.json`).
   - Healthcheck defined (`Config.Healthcheck`) — advisory.
9. Optional SBOM:
   `syft "$IMAGE" -o cyclonedx-json > "$OUT_DIR/sbom.cdx.json"`.
10. Aggregate and write `container-scan-report.md`:
    - Gate table: Critical CVE, High CVE, Secrets in layers, Non-root,
      Dockerfile issues (each row: status + count).
    - Findings grouped by severity with fix-version hints.
    - Upgrade plan: which base-image bump clears the most CVEs.
11. Exit non-zero if any gate in `$FAIL_ON` failed.

## Examples

### Example 1 — registry-ready check

```
IMAGE=ghcr.io/acme/api:1.14.2 \
OUT_DIR=/tmp/cs-api \
FAIL_ON=CRITICAL,HIGH \
./run-container-scan.sh
```

Expected `container-scan-report.md` gate table:

```
| Gate                       | Status | Count |
|----------------------------|--------|-------|
| Critical CVE               | FAIL   | 1     |
| High CVE                   | WARN   | 3     |
| Secrets in layers          | PASS   | 0     |
| Non-root user (UID != 0)   | PASS   | 1001  |
| Distroless base heuristic  | PASS   | yes   |
| Dockerfile lint            | PASS   | 2 info|

Exit: 2 (Critical CVE gate failed)
```

### Example 2 — Dockerfile linting prior to build

```
DOCKERFILE=./Dockerfile CONTEXT=. \
OUT_DIR=./scan \
./run-container-scan.sh
```

Expected excerpt:

```
[container-scan] building scan-target:tmp
[container-scan] hadolint: DL3008 Pin versions in apt-get install (line 7)
[container-scan] hadolint: DL3025 Use arguments JSON notation for CMD
[container-scan] trivy image: 0 critical, 0 high, 4 medium (alpine 3.19.1)
[container-scan] user=appuser (uid=1001). PASS
```

## Constraints

- Never push an image marked FAIL. The skill only reports; it never calls
  `docker push`.
- Treat `IGNORE_UNFIXED=1` as a supply-chain risk — the report flags
  ignored CVEs in an "Accepted risks" section.
- Do not exfiltrate image contents. All scanning is local to the host
  running the skill.
- Base-image recommendations must name a concrete tag + digest, never
  "latest".
- Never suggest `chmod 777` or `USER root` as a fix for a permissions
  finding.

## Quality checks

- [ ] Every gate row in the report has an explicit PASS/FAIL/WARN.
- [ ] Non-root check inspects actual UID, not just `USER` directive string.
- [ ] Critical CVEs cite CVE ID and include a fix version if OSV has one.
- [ ] Secrets-in-layers findings reference the layer digest.
- [ ] SBOM (if generated) is valid CycloneDX 1.5+ (schema-check with
      `cyclonedx-cli validate` when available).

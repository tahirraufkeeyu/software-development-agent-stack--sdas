---
name: container-remediation
description: Use when container-scan has produced findings on a Docker/OCI image and you need to rebuild it clean. Rebases to a patched base image, upgrades OS packages, hardens the Dockerfile (non-root user, distroless or slim, multi-stage, HEALTHCHECK), strips secrets from layers using BuildKit mounts, and verifies closure by re-scanning with Trivy.
safety: writes-shared
produces: security/remediation/container-<image>-<date>.md
consumes:
  - security/findings/container.json
---

## When to use

- `container-scan` has produced `security/findings/container.json` with HIGH or CRITICAL findings.
- A registry vulnerability scanner (ECR, GCR, Harbor, Docker Hub) has flagged an image and blocked promotion.
- A base-image update is available that closes multiple open CVEs in one rebase.
- The image is running as root, has a shell as PID 1, or is missing standard Dockerfile hygiene and you're doing a posture pass.
- An audit discovered a secret baked into a layer (visible via `docker history` or `dive`).

Do not use this skill to fix application-code vulnerabilities inside the image — that's `vulnerability-remediation`. Do not use it to fix runtime K8s misconfig (PodSecurityStandard, seccomp) — that's an infrastructure skill.

## Inputs

- `security/findings/container.json` with image name, tag, digest, and findings list.
- The `Dockerfile` (and any multi-stage chain) that produced the image.
- Registry push credentials and a CI build runner.
- The downstream deployment manifests (K8s, ECS, Nomad) so the new digest can be rolled out.

## Outputs

- `security/remediation/container-<image>-<date>.md` — remediation audit trail.
- A new image tag pushed to the registry, pinned by digest in deployment manifests.
- A hardened, smaller, reproducibly-built `Dockerfile`.
- Trivy re-scan output attached to the report.

## Tool dependencies

- `docker` (or `podman`, `buildah`) with BuildKit enabled (`DOCKER_BUILDKIT=1`).
- `trivy` for image + secret + misconfig scanning.
- `dive` or `docker history` for layer inspection.
- `cosign` for image signing (optional but recommended).
- Registry CLI: `aws ecr`, `gcloud`, `docker login`, as applicable.

## Procedure

1. **Classify findings.** Each entry in `container.json` falls into one of:

   | Bucket | Source | Fix approach |
   |---|---|---|
   | OS-package CVE | `apt`/`apk`/`yum` package in base | Rebase to patched base tag; rebuild |
   | Language runtime CVE | e.g. Node/Python binary shipped in base | Rebase to patched runtime tag |
   | Dockerfile misconfig | `USER root`, shell PID 1, no `HEALTHCHECK`, COPY `.env` | Rewrite Dockerfile |
   | Secret in layer | `docker history` shows env-var or COPY'd file | Rebuild from scratch using BuildKit `--mount=type=secret`; also rotate (hand off to `secret-remediation`) |
   | Large attack surface | Bloated image with dev tools at runtime | Multi-stage split, drop tool chain from runner |

2. **Pick the new base.** In priority order:
   - **Distroless** (`gcr.io/distroless/nodejs20-debian12`, `gcr.io/distroless/python3-debian12`, `gcr.io/distroless/static-debian12`) — zero shell, zero package manager, smallest attack surface.
   - **Alpine** (`alpine:3.19`, `node:20-alpine3.19`) — small but uses musl; verify your native deps are musl-compatible.
   - **Slim Debian/Ubuntu** (`node:20.12.2-bookworm-slim`, `python:3.12-slim-bookworm`) — when you need glibc.

   Pin by digest for reproducibility:
   ```dockerfile
   FROM node:20.12.2-alpine3.19@sha256:2b6bc32c2d71c6e27a0e6a58b9e1c5c0f4b2d3e4f5a6c7d8e9f0a1b2c3d4e5f6
   ```

3. **Rewrite the Dockerfile with a hardened template.**

   Before — typical overlooked image:
   ```dockerfile
   FROM node:18
   COPY . /app
   WORKDIR /app
   RUN npm install
   CMD npm start
   ```

   After — distroless, multi-stage, non-root, no shell, reproducible:
   ```dockerfile
   # syntax=docker/dockerfile:1.7

   # --- builder ---
   FROM node:20.12.2-alpine3.19@sha256:<pinned-digest> AS builder
   WORKDIR /app
   COPY package*.json ./
   RUN --mount=type=cache,target=/root/.npm \
       npm ci --omit=dev
   COPY . .
   RUN npm run build

   # --- runtime ---
   FROM gcr.io/distroless/nodejs20-debian12@sha256:<pinned-digest>
   WORKDIR /app
   COPY --from=builder --chown=nonroot:nonroot /app/node_modules ./node_modules
   COPY --from=builder --chown=nonroot:nonroot /app/dist ./dist
   COPY --from=builder --chown=nonroot:nonroot /app/package.json ./package.json

   USER nonroot
   EXPOSE 3000
   HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
     CMD ["node", "dist/health.js"]
   ENTRYPOINT ["node", "dist/server.js"]
   ```

   Key hardening rules applied:
   - Multi-stage: toolchain stays in `builder`, runtime has no `npm` / `node_modules` build artifacts.
   - Pinned by digest — reproducible rebuilds.
   - Non-root user (distroless `nonroot` is UID 65532, K8s-compatible).
   - No shell in runtime; exec-form `ENTRYPOINT`.
   - `HEALTHCHECK` so orchestrators catch sick containers.
   - `--mount=type=cache` speeds up builds without leaking cache into the image.

4. **Strip secrets from layers properly.** If a build needs a secret (NPM token, private repo SSH key), use BuildKit mounts — do not COPY then delete:
   ```dockerfile
   # syntax=docker/dockerfile:1.7
   RUN --mount=type=secret,id=npm_token \
       NPM_TOKEN=$(cat /run/secrets/npm_token) \
       npm ci --registry=https://registry.npmjs.org/ --//registry.npmjs.org/:_authToken=$NPM_TOKEN
   ```
   Build with:
   ```bash
   DOCKER_BUILDKIT=1 docker build \
     --secret id=npm_token,src=$HOME/.npmrc \
     -t acme/api:2.14.0 .
   ```
   The secret never lands in any layer. Verify with `docker history --no-trunc acme/api:2.14.0` — no trace of the value.

5. **Build, scan, push.**
   ```bash
   # Build with no cache to be sure nothing old is re-used
   DOCKER_BUILDKIT=1 docker build --no-cache \
     --tag acme/api:2.14.0 \
     --tag acme/api:$(git rev-parse --short HEAD) .

   # Scan CVEs + secrets + misconfig
   trivy image \
     --severity CRITICAL,HIGH \
     --scanners vuln,secret,misconfig \
     --exit-code 1 \
     acme/api:2.14.0

   # Sign (optional but recommended)
   cosign sign --key cosign.key acme/api:2.14.0

   # Push
   docker push acme/api:2.14.0
   ```

   If `trivy` exits non-zero → fix or file an exception before promoting.

6. **Pin by digest in deployment manifests.**

   K8s:
   ```yaml
   spec:
     containers:
       - name: api
         image: acme/api:2.14.0@sha256:a1b2c3d4e5f6...
   ```

   ECS task def: use the `@sha256:…` suffix on the image ARN.

   Tag-only references are unstable (registry can repoint them) — always pin by digest in production.

7. **Roll out and verify.**
   ```bash
   kubectl set image deployment/api api=acme/api:2.14.0@sha256:a1b2c3...
   kubectl rollout status deployment/api --timeout=5m
   # Confirm ready pods are on the new digest
   kubectl get pods -l app=api -o jsonpath='{.items[*].spec.containers[0].image}'
   ```

8. **Write remediation report.** `security/remediation/container-<image>-<date>.md` contains:
   - Before/after image digests, sizes, layer counts.
   - CVEs closed (list with IDs + severity).
   - Dockerfile changes summary (bulleted).
   - Trivy scan output (before + after).
   - Rollout evidence (timestamp, pod digest match).
   - Any CVEs kept with exceptions (vendor patch pending, etc.).

## Examples

### Example 1 — Node runtime rebase with hardening

`container.json` excerpt:
```json
{
  "image": "acme/api",
  "tag": "1.8.2",
  "digest": "sha256:c0ffee…",
  "findings": [
    {"cve": "CVE-2023-52425", "severity": "HIGH", "package": "libxml2", "fixed_in": "2.10.4-3+deb12u1"},
    {"cve": "CVE-2024-0727", "severity": "HIGH", "package": "openssl", "fixed_in": "3.0.13-1~deb12u1"},
    {"cve": "CVE-2023-45853", "severity": "MEDIUM", "package": "zlib", "fixed_in": "1:1.2.13.dfsg-1+deb12u1"},
    {"misconfig": "root user", "severity": "MEDIUM", "rule": "DS002"}
  ]
}
```

Before (`Dockerfile`):
```dockerfile
FROM node:18-slim
COPY . /app
WORKDIR /app
RUN npm install
EXPOSE 3000
CMD ["npm", "start"]
```

After:
```dockerfile
# syntax=docker/dockerfile:1.7

FROM node:20.12.2-alpine3.19@sha256:2b6bc32c... AS builder
WORKDIR /app
COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev
COPY . .

FROM gcr.io/distroless/nodejs20-debian12@sha256:1a2b3c4d...
WORKDIR /app
COPY --from=builder --chown=nonroot:nonroot /app/node_modules ./node_modules
COPY --from=builder --chown=nonroot:nonroot /app /app
USER nonroot
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD ["node", "dist/health.js"]
ENTRYPOINT ["node", "dist/server.js"]
```

Build + scan + push:
```bash
DOCKER_BUILDKIT=1 docker build --no-cache -t acme/api:1.8.3 .
trivy image --severity CRITICAL,HIGH --exit-code 1 acme/api:1.8.3
# INFO    Total: 0 (HIGH: 0, CRITICAL: 0)
docker push acme/api:1.8.3
```

Report excerpt:
```markdown
## acme/api 1.8.2 → 1.8.3

Base: node:18-slim → gcr.io/distroless/nodejs20-debian12
Size: 832 MB → 142 MB (–83%)
Layers: 14 → 7

### CVEs closed
- CVE-2023-52425 (HIGH, libxml2)
- CVE-2024-0727 (HIGH, openssl)
- CVE-2023-45853 (MEDIUM, zlib)

### Misconfigs closed
- DS002 (root user) — runtime now runs as `nonroot` (UID 65532)
- Missing HEALTHCHECK — added

### Scan evidence
trivy image ... 1.8.3 → 0 CRITICAL, 0 HIGH (pre-rollout)
```

### Example 2 — secret baked into a build layer

`container.json` excerpt (Trivy secret scanner):
```json
{
  "image": "acme/worker:2.0.1",
  "findings": [
    {"type": "secret", "rule": "aws-access-key-id", "layer_digest": "sha256:d3adbeef…", "value_fragment": "AKIAI..."}
  ]
}
```

`docker history --no-trunc acme/worker:2.0.1` shows:
```
COPY .env . # buildkit          1.4kB
RUN rm .env                      0B
```

The `rm` is useless — the earlier layer still holds the file. Fix requires rebuild from scratch AND credential rotation:

1. Rotate the leaked AWS key (hand off to `secret-remediation`).
2. Remove `.env` copying entirely; rewrite to use BuildKit secret mount:
   ```dockerfile
   # syntax=docker/dockerfile:1.7
   FROM python:3.12-slim-bookworm AS runner
   WORKDIR /app
   COPY requirements.txt .
   RUN --mount=type=secret,id=pip_extra_index \
       PIP_EXTRA_INDEX_URL=$(cat /run/secrets/pip_extra_index) \
       pip install --no-cache-dir -r requirements.txt
   COPY src/ ./src/
   USER nobody
   ENTRYPOINT ["python", "-m", "src.worker"]
   ```
3. Rebuild from scratch with no cache:
   ```bash
   docker build --no-cache --pull \
     --secret id=pip_extra_index,src=secrets/pip_index \
     -t acme/worker:2.0.2 .
   ```
4. Verify the new image has no secrets anywhere:
   ```bash
   trivy image --scanners secret acme/worker:2.0.2
   # no secrets detected
   dive acme/worker:2.0.2                       # inspect layers; confirm no .env
   ```
5. Re-tag and push; deployment manifests pin to new digest. The old tag `2.0.1` should be deleted from the registry (`aws ecr batch-delete-image`) to prevent accidental re-pull.

Report excerpt:
```markdown
### Secret in layer — acme/worker:2.0.1
- Leaked credential: AWS access key `AKIA…LMNO` found in layer `sha256:d3adbeef…` via COPY of `.env`.
- Rotation: handed to secret-remediation (see secrets-2026-04-20.md sec-003).
- Rebuild: 2.0.2 uses `--mount=type=secret`; re-scan with `trivy image --scanners secret` → 0 findings.
- Old tag: deleted from registry; old digest unreferenced in any deployment manifest.
```

## Constraints

- Never try to "patch" an image by layering fixes on top of a compromised base. Rebuild from scratch, always with `--no-cache`.
- Never `COPY` a secret into an image then `RUN rm` it. The earlier layer persists. Use BuildKit secret mounts.
- Never leave the runtime as root without an explicit exception. Distroless `nonroot` or a pinned numeric UID are standard.
- Never push without a trivy re-scan that passes the severity gate configured for the repo.
- Pin production deployments by digest, not just tag. Tags can be repointed; digests cannot.

## Quality checks

- `trivy image --severity CRITICAL,HIGH --exit-code 1 <new-tag>` passes (exit 0).
- `docker history --no-trunc <new-tag>` contains no credential material or secret-bearing filenames.
- Image size and layer count reduced (or at least not worse) compared to the previous tag.
- Deployment manifests reference the new image by `@sha256:…` digest, not just tag.
- Old vulnerable tag deleted from registry (or marked immutable+quarantined) so it cannot be accidentally pulled.

---
name: ssl-certificate-manager
description: Use when a user wants to audit TLS certificates across a Kubernetes estate, migrate to cert-manager with Let's Encrypt (HTTP-01 or DNS-01), set up expiry alerts (≤30d warning / ≤7d critical), or rotate certs without downtime. Runs a cert inventory, issues / renews via cert-manager, and validates the ingress still serves the new chain.
safety: writes-shared
supported-stacks:
  - cert-manager+k8s
---

## When to use

- User says "audit our certs", "some cert is expiring", "install cert-manager", "switch to Let's Encrypt", "rotate the ingress cert", or asks about HTTP-01 vs DNS-01.
- CI or monitoring flagged a cert expiring within 30 days.
- Migrating from manual cert upload (Secret holding `tls.crt`/`tls.key`) to automated issuance.
- A wildcard cert is required (forces DNS-01).
- A mutual-TLS setup needs an internal CA (private PKI; this skill can drive cert-manager's CA issuer).

Do not use this skill for code-signing certs, SSH keys, or client certs unrelated to TLS termination.

## Inputs

- Kubeconfig context; list of target namespaces.
- List of hostnames that must be covered (may include wildcards).
- Issuance strategy: HTTP-01 (public, per-host), DNS-01 (wildcards or private), or an internal CA.
- DNS provider (Route53, Cloud DNS, Cloudflare, Azure DNS) and credentials for DNS-01.
- ACME contact email.
- Alert destinations: reuse the Alertmanager config from `monitoring-setup`.

## Outputs

- A cert inventory CSV/table: `host | issuer | NotBefore | NotAfter | daysLeft | source (cert-manager | manual | external) | namespace | secret`.
- cert-manager installed and healthy.
- `ClusterIssuer` resources: `letsencrypt-staging`, `letsencrypt-prod`, optionally `internal-ca`.
- `Certificate` resources for every managed host.
- Alertmanager rules for `CertExpiringWarn` (<30d) and `CertExpiringSoon` (<7d) — already defined in `monitoring-setup/references/alertmanager-rules-template.yaml`.
- A rotation runbook: how to force-renew without downtime, how to roll back.

## Tool dependencies

- `kubectl`, `helm`, `openssl`, `dig`, `curl`, `jq`, `yq`.
- `cmctl` (cert-manager CLI) for issue/renew/status.
- Kubernetes MCP, filesystem MCP, optionally AWS/GCP/Azure MCP for DNS-01 IAM setup.

## Procedure

1. **Detect the stack.** Run these read-only commands and record findings:
   - `kubectl config current-context` — confirm a Kubernetes cluster is addressable. No cluster → stop; this skill requires `kubernetes`.
   - `kubectl get crd certificates.cert-manager.io 2>/dev/null` — cert-manager installed?
   - `helm list -A 2>/dev/null | grep -Ei 'cert-manager|jetstack'` — cert-manager via Helm?
   - `kubectl get ingressclass 2>/dev/null` — what ingress controller is in use (nginx, traefik, istio, contour)?
   - `kubectl get secrets -A --field-selector type=kubernetes.io/tls -o name 2>/dev/null | head` — existing TLS secrets (manual uploads vs managed)?
   - `ls aws-load-balancer-controller/ 2>/dev/null` or `kubectl get crd targetgroupbindings.elbv2.k8s.aws 2>/dev/null` — AWS ALB/ACM in the mix instead?

   Confirm the detected stack is `cert-manager+k8s`. If the cluster uses AWS ACM directly via ALB, GCP managed certs via GKE ingress, Azure Key Vault certs, or a commercial CA workflow (Sectigo / DigiCert via manual CSR), STOP and report the detected stack to the user — those are different issuance/rotation surfaces and cert-manager config here would be misleading.
2. Inventory. Build the full cert list.
   ```
   # cert-manager-managed certs
   kubectl get certificates -A -o json | jq -r '
     .items[] | [.metadata.namespace, .metadata.name, .spec.secretName, (.status.notAfter // "pending")] | @tsv'

   # TLS secrets regardless of source
   kubectl get secrets -A --field-selector type=kubernetes.io/tls -o json | jq -r '
     .items[] | [.metadata.namespace, .metadata.name,
       ((.data."tls.crt" | @base64d) | split("-----BEGIN CERTIFICATE-----")[1])] | @tsv'

   # Live-edge scan per hostname (what a client actually sees)
   for h in api.example.com app.example.com; do
     echo | openssl s_client -connect "$h:443" -servername "$h" 2>/dev/null \
       | openssl x509 -noout -issuer -subject -dates -ext subjectAltName
   done
   ```
   For each TLS secret, decode and inspect:
   ```
   kubectl -n <ns> get secret <name> -o json \
     | jq -r '.data["tls.crt"]' | base64 -d \
     | openssl x509 -noout -issuer -subject -dates -ext subjectAltName
   ```
   Compare to the live edge. Mismatches (ingress serving a stale cert) usually mean the ingress controller needs a reload.

3. Install cert-manager if missing:
   ```
   helm repo add jetstack https://charts.jetstack.io
   helm repo update
   helm upgrade --install cert-manager jetstack/cert-manager \
     --namespace cert-manager --create-namespace \
     --version v1.15.3 --set crds.enabled=true --wait
   ```
   Validate: `kubectl -n cert-manager get pods`, `cmctl check api`.

4. Create ClusterIssuers. Start with staging to avoid the Let's Encrypt rate limit while iterating.
   ```yaml
   apiVersion: cert-manager.io/v1
   kind: ClusterIssuer
   metadata:
     name: letsencrypt-staging
   spec:
     acme:
       server: https://acme-staging-v02.api.letsencrypt.org/directory
       email: ops@example.com
       privateKeySecretRef: { name: letsencrypt-staging-key }
       solvers:
         - http01:
             ingress: { ingressClassName: nginx }
   ---
   apiVersion: cert-manager.io/v1
   kind: ClusterIssuer
   metadata:
     name: letsencrypt-prod
   spec:
     acme:
       server: https://acme-v02.api.letsencrypt.org/directory
       email: ops@example.com
       privateKeySecretRef: { name: letsencrypt-prod-key }
       solvers:
         - http01:
             ingress: { ingressClassName: nginx }
           selector:
             dnsZones: ["example.com"]
         - dns01:
             route53:
               region: eu-west-1
               hostedZoneID: Z123ABC
           selector:
             dnsZones: ["example.com"]
   ```
   HTTP-01 requires the ingress to be reachable from the public internet on :80. DNS-01 requires IRSA / Workload Identity binding to a DNS-write IAM role; never use static long-lived AWS keys.

5. Issue certs. For each hostname group:
   ```yaml
   apiVersion: cert-manager.io/v1
   kind: Certificate
   metadata:
     name: api-example-com
     namespace: app
   spec:
     secretName: api-example-com-tls
     issuerRef: { name: letsencrypt-prod, kind: ClusterIssuer }
     dnsNames:
       - api.example.com
     privateKey:
       algorithm: ECDSA
       size: 256
       rotationPolicy: Always
     renewBefore: 720h   # 30d
   ```
   Reference the secret from the Ingress:
   ```yaml
   spec:
     tls:
       - hosts: [api.example.com]
         secretName: api-example-com-tls
   ```
   Wait for `Ready=True`:
   ```
   kubectl -n app wait certificate/api-example-com --for=condition=Ready --timeout=5m
   cmctl status certificate -n app api-example-com
   ```

6. For wildcards (`*.example.com`): HTTP-01 cannot issue wildcards; DNS-01 only. Use the `dns01` solver above and confirm the `_acme-challenge.example.com` TXT record is being created and deleted by cert-manager (check with `dig +short TXT _acme-challenge.example.com`).

7. Alerts. Apply the rules from `monitoring-setup/references/alertmanager-rules-template.yaml` (the `tls` group). Add a blackbox-exporter probe per hostname:
   ```yaml
   apiVersion: monitoring.coreos.com/v1
   kind: Probe
   metadata:
     name: public-hosts
     namespace: monitoring
   spec:
     jobName: blackbox-https
     interval: 60s
     module: http_2xx
     prober:
       url: blackbox-exporter.monitoring.svc:9115
     targets:
       staticConfig:
         static:
           - https://api.example.com
           - https://app.example.com
   ```

8. Zero-downtime rotation. To force a renew:
   ```
   cmctl renew -n app api-example-com
   ```
   cert-manager writes a new `tls.crt`/`tls.key` into the existing secret. Ingress controllers (nginx, Traefik, HAProxy, Istio) hot-reload when the secret's data changes; no pod restart required. Validate:
   ```
   echo | openssl s_client -connect api.example.com:443 -servername api.example.com 2>/dev/null \
     | openssl x509 -noout -dates
   ```
   Confirm `notAfter` advanced. If an ingress is pinned to a mounted file (e.g. Envoy with `path:` instead of `sds:`), rotation requires a pod restart — flag this during the inventory.

9. Roll-back. Keep the prior secret for 7 days. cert-manager retains the previous issuance in `status.previousIssuedCertificate` when `rotationPolicy: Always` is set. To pin the old cert temporarily, revert the Ingress `secretName` to the previous secret.

## Examples

### Happy path: HTTP-01 for 5 public hosts on nginx-ingress

Inventory found 5 manually-uploaded certs expiring within 45 days. After install:

```
ClusterIssuer: letsencrypt-prod (HTTP-01 via nginx)
Certificates issued: 5/5 Ready
Secrets rotated: 5 (zero-downtime; nginx hot-reload confirmed)
Alerts active: CertExpiringWarn (<30d), CertExpiringSoon (<7d)
```

### Edge case: wildcard cert for a private zone

`*.internal.example.com` only resolves inside the VPC. HTTP-01 is impossible (no public reachability). Approach:

1. Create a Route53 hosted zone and delegate `internal.example.com` to it from the public zone.
2. Attach an IRSA role with `route53:ChangeResourceRecordSets` scoped to the zone ID.
3. Use DNS-01 solver as shown above; certificate issues even though the service itself is VPC-only.
4. Alternative for air-gapped clusters: use cert-manager's `CA` issuer with an internal root; distribute the root to clients via MDM / Trust Bundle. No Let's Encrypt involved.

## Constraints

- Do not produce output for a stack outside `supported-stacks`. If detection shows AWS ACM+ALB, GCP managed certs, Azure Key Vault certs, or a commercial-CA manual-CSR workflow as the issuance surface, STOP and report the detected stack. cert-manager YAML in those environments either does nothing or competes with the real issuance path.
- Never use ACME HTTP-01 for a wildcard cert; the protocol does not support it. DNS-01 only.
- Never commit DNS-provider long-lived credentials. Always use IRSA (EKS), Workload Identity (GKE), or Managed Identity (AKS) for the DNS-01 solver.
- Never issue directly against `letsencrypt-prod` while iterating; stage first. The Let's Encrypt rate limit is 50 certs per registered domain per week.
- Never reuse the same `privateKeySecretRef` across staging and prod issuers.
- Never set `renewBefore` shorter than 360h (15d); renewal failures need buffer time.
- Never remove the previous secret the same day you rotate; keep it for at least 7 days for rollback.

## Quality checks

- Every production hostname has a `Certificate` with `Ready=True` and `notAfter` more than 30 days out.
- `cmctl check api` exits 0.
- The live-edge scan (`openssl s_client`) issuer matches the cert-manager issuer for every managed host.
- Alertmanager shows `CertExpiringWarn`/`CertExpiringSoon` rules loaded (`amtool config routes test severity=critical alertname=CertExpiringSoon`).
- `kubectl get events -n cert-manager --sort-by=.lastTimestamp | tail` shows no `Failed` or `Error` events in the last 24 h.
- Blackbox-exporter `probe_success` for every host == 1.
- DNS-01 credentials are provided via IRSA / Workload Identity, not static keys (verified by inspecting the solver pod's environment).
- The rotation runbook has been executed once end-to-end during the install (force-renew, verify new `notAfter`, verify no 5xx during the window).

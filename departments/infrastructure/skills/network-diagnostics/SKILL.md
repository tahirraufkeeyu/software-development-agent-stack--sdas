---
name: network-diagnostics
description: Use when a user reports connectivity failures, "can't reach X", DNS issues, TLS handshake errors, timeouts, or suspected firewall/NetworkPolicy problems. Walks a layered flow from DNS to TCP to TLS to application, audits K8s NetworkPolicy, cloud firewall / NSG rules, MTU, and emits a structured diagnosis with the exact failing layer and fix.
safety: safe
---

## When to use

- User says "can't connect to …", "times out", "dns doesn't resolve", "certificate error", "SYN but no SYN-ACK", "works from my laptop but not from the pod".
- Cross-namespace or cross-cluster traffic broke after a NetworkPolicy / CNI / security-group change.
- A previously-working external dependency (database, SaaS, S3) started returning errors.
- VPN, peering, Transit Gateway, or route table changes are suspected.
- MTU issues after a new CNI or VPN tunnel (symptom: small requests work, larger ones hang).

Do not use this skill for application-level 4xx/5xx without a connectivity symptom (route that to the owning service's logs and `monitoring-setup`).

## Inputs

- Source (pod / node / laptop) and destination (hostname or IP:port).
- Expected protocol (HTTP, HTTPS, gRPC, TCP, UDP).
- What changed recently (deploys, NetworkPolicy, security-group, DNS records, CNI upgrade).
- Symptom class: "doesn't resolve", "refused", "times out", "resets", "TLS error".

## Outputs

- A layer-by-layer report: `Layer | Test | Result | Evidence | Verdict`.
- The specific failing layer (DNS / routing / firewall / TLS / application) with the root cause.
- A concrete fix (command, manifest patch, cloud console action).
- Optional: a runbook entry so the next occurrence is resolved in minutes.

## Tool dependencies

- `kubectl`, `dig`, `nslookup`, `host`, `getent`, `nc` (netcat), `telnet`, `mtr`, `traceroute`, `tcpdump`, `ss`, `ip`, `openssl`, `curl`, `wget`, `jq`.
- Kubernetes MCP for NetworkPolicy / Endpoints inspection.
- AWS/GCP/Azure MCP for security-group / NSG / firewall-rule inspection.
- A debug pod image (`nicolaka/netshoot`) for in-cluster diagnostics:
  ```
  kubectl run netshoot -n <ns> --rm -it --image=nicolaka/netshoot --restart=Never -- bash
  ```

## Procedure

Walk these layers in order. Stop at the first failure and fix before continuing; downstream layers cannot pass if upstream layers fail.

### 1. DNS resolution

From the affected source:
```
dig +short A api.example.com
dig +short AAAA api.example.com
dig +trace api.example.com            # authoritative path
nslookup api.example.com 8.8.8.8      # bypass the local resolver
getent hosts api.example.com          # what libc sees (includes /etc/hosts, NSS)
```

Inside Kubernetes:
```
kubectl exec -n <ns> <pod> -- nslookup api.example.com
kubectl exec -n <ns> <pod> -- cat /etc/resolv.conf
kubectl -n kube-system get pods -l k8s-app=kube-dns
kubectl -n kube-system logs -l k8s-app=kube-dns --tail=200 | grep -i error
```

Common failures:
- `NXDOMAIN` → record missing or wrong zone; `dig +trace` shows the authoritative gap.
- `SERVFAIL` → upstream DNSSEC validation failed or resolver is broken.
- Intermittent failure → CoreDNS pod is overwhelmed; check `coredns_dns_requests_total` rate vs replica count; scale or enable `autopath`/`nodelocaldns`.
- `.cluster.local` search-domain delay → add `ndots: 2` to pod dnsConfig or use FQDN.

### 2. TCP reachability

```
nc -vz api.example.com 443         # from source
mtr -rwc 50 api.example.com        # hop-by-hop loss / latency
traceroute -T -p 443 api.example.com
ss -tn state established           # existing connections on the host
```

Expected outcomes:
- `succeeded!` → TCP OK, continue to TLS.
- `No route to host` → routing problem; check `ip route`, VPC route tables, Transit Gateway.
- `Connection refused` → reached the destination but nothing is listening on that port; check the service/endpoints.
- `Connection timed out` → a silent drop (firewall, security group, NetworkPolicy). Use `mtr` to see which hop stops responding.

### 3. TLS handshake

```
openssl s_client -connect api.example.com:443 -servername api.example.com -showcerts </dev/null
openssl s_client -connect api.example.com:443 -servername api.example.com -tls1_2 </dev/null
curl -v --resolve api.example.com:443:<ip> https://api.example.com/healthz
```

Inspect for:
- Cert chain issuer and `notAfter` — delegates to `ssl-certificate-manager` if expired.
- SNI mismatch: `subject`/`subjectAltName` not including the hostname.
- Protocol/cipher mismatch: client requires TLS 1.3, server only offers 1.0.
- Self-signed cert served from a staging issuer in prod.

### 4. K8s NetworkPolicy audit

```
kubectl -n <dst-ns> get networkpolicies
kubectl -n <dst-ns> describe networkpolicy <name>
kubectl get endpoints -n <dst-ns> <svc>
```

If NetworkPolicies exist in `<dst-ns>`, the default is deny for unlisted ingress once any policy selects the target pod. Confirm:
- The source pod's labels match an `from.podSelector`.
- If cross-namespace, the source namespace labels match `from.namespaceSelector`.
- Port and protocol are permitted.

Debug from inside with netshoot:
```
kubectl run netshoot -n <src-ns> --rm -it --image=nicolaka/netshoot --labels="app=probe" --restart=Never -- \
  curl -v --max-time 5 http://<svc>.<dst-ns>.svc.cluster.local/
```
If it fails, temporarily apply a permissive NetworkPolicy to the destination and retry. If it now passes, write the minimal allow policy and remove the permissive one.

### 5. Cloud firewall / Security Group / NSG

- AWS: `aws ec2 describe-security-groups --group-ids sg-xxx` and `describe-network-acls`. Check both the source and destination SGs; inbound + outbound.
- GCP: `gcloud compute firewall-rules list --filter="network:<vpc>"`.
- Azure: `az network nsg rule list --nsg-name <nsg> -g <rg>`.
- On-prem: the edge firewall's rule log — look for `DROP` entries matching the source/destination at the time of the failure.

For a pod-to-RDS case, the SG chain is: node SG → RDS SG. RDS SG must allow `tcp/5432` from node SG (not from a CIDR; reference by SG id).

### 6. MTU

Symptom: small requests (`curl http://svc/health`) work, larger requests (uploads, streaming) hang.

```
# verify path MTU
ping -M do -s 1472 api.example.com     # 1472 + 28 = 1500
ping -M do -s 1420 api.example.com     # common VXLAN overhead

# lower pod MTU via CNI config or init script
ip link show eth0 | awk '/mtu/ {print $5}'
```

Typical needed MTUs:
- AWS VPC standard: 1500.
- AWS VPC with Transit Gateway: 8500 inside the VPC, 1500 across TGW.
- VXLAN overlay (Flannel, Calico IPIP): 1450.
- IPSec VPN: 1436.
- Wireguard: 1420.

If path MTU is lower than the interface MTU and PMTUD is broken (ICMP Frag-Needed being dropped), TCP will hang on large writes. Fix: either lower the pod/VPN MTU, or ensure ICMP type 3 code 4 is allowed end-to-end.

### 7. Final summary

Emit the report:

```
Layer              | Test                               | Result     | Evidence
DNS                | dig +short api.example.com         | ok         | 10.1.2.3
TCP                | nc -vz 10.1.2.3 443                | timeout    | 3x retry, no SYN-ACK
Firewall           | SG sg-abc outbound 443 to sg-xyz   | MISSING    | aws ec2 describe-sg ...
TLS                | skipped                            | -          | blocked by TCP
App                | skipped                            | -          | blocked by TCP

Verdict: Egress security group sg-abc is missing rule allowing tcp/443 to sg-xyz (RDS proxy SG).
Fix: aws ec2 authorize-security-group-egress --group-id sg-abc --protocol tcp --port 443 --source-group sg-xyz
```

## Examples

### Happy path: pod cannot reach an in-cluster service after a NetworkPolicy rollout

Symptom: `payments` namespace pods can no longer reach `redis.cache.svc.cluster.local:6379`. Recent change: platform team rolled out default-deny policies to `cache` namespace.

Diagnosis:

```
DNS     | nslookup redis.cache.svc      | ok     | 10.96.12.34
TCP     | nc -vz 10.96.12.34 6379       | timeout
Policy  | kubectl -n cache get netpol   | found  | default-deny-ingress + allow-from-payments missing "app=api"
```

Fix:
```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-payments-api-to-redis
  namespace: cache
spec:
  podSelector: { matchLabels: { app: redis } }
  policyTypes: [Ingress]
  ingress:
    - from:
        - namespaceSelector: { matchLabels: { kubernetes.io/metadata.name: payments } }
          podSelector: { matchLabels: { app: api } }
      ports:
        - protocol: TCP
          port: 6379
```

### Edge case: intermittent 502s only on file uploads from EU region

Small requests 200, uploads >1 MB fail with 502 after ~30 s. Only EU region, recently migrated to a new VPN tunnel.

Diagnosis: `ping -M do -s 1472` fails with `Message too long`; succeeds at `-s 1436`. The VPN tunnel MTU is 1436 but the pod interface is 1500, and the cloud firewall is dropping ICMP Frag-Needed. PMTUD broken → TCP hangs on large writes → proxy times out → 502.

Fix options:
- Set pod MTU to 1436 via CNI config (Calico: `veth_mtu: 1436`; Cilium: `--mtu 1436`).
- Or allow ICMP type 3 code 4 end-to-end so PMTUD works.

## Constraints

- Never skip a layer because the previous one "looks fine"; silent drops often mimic upstream passes.
- Never mutate production firewall / NSG / NetworkPolicy rules without capturing the pre-state (`aws ec2 describe-security-groups ... > pre.json`) for rollback.
- Never use plain `ping` as the primary TCP reachability probe; ICMP may be allowed while the target port is blocked.
- Never trust a single traceroute — routes change; repeat with `mtr -c 100`.
- Never add a permissive `0.0.0.0/0` rule to "just get it working"; narrow to the exact source.
- Never run `tcpdump` on a production node without filtering to the affected 5-tuple.

## Quality checks

- The failing layer is identified with direct evidence (command output pasted into the report).
- The fix is reproducible and scoped to the minimal change.
- The report includes a rollback command or manifest.
- If the fix touches a NetworkPolicy, a re-test from a pod with the source labels confirmed the traffic now passes.
- If the fix touches a security group / NSG / firewall rule, the pre- and post-rule JSON is captured.
- If the symptom was DNS, CoreDNS pod count and error rate were checked, not just resolution of the failing name.
- If MTU was the root cause, `ping -M do -s <N>` output is included.

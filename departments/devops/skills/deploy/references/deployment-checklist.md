# Deployment Checklist

Walk this list top-to-bottom for every production deploy. For staging, the pre-deploy section is still mandatory; during/post items scale to risk.

## Pre-deploy (T minus 1 day to T minus 1 hour)

1. Change ticket opened with summary, risk level, and blast radius.
2. PR has at least one approval from a code owner and all required checks are green.
3. All database migrations are reviewed for: backward compatibility (expand before contract), lock duration, index creation concurrency (`CREATE INDEX CONCURRENTLY`), and impact on replicas.
4. Migrations that add NOT NULL columns have a default or a separate backfill phase.
5. Rollback plan is documented in the ticket. For schema changes, the rollback includes the reverse migration or an `expand/contract` plan to avoid a destructive rollback.
6. Feature flags default to OFF. New flags have an owner and a removal-by date.
7. Secrets referenced by new code exist in the target environment's secret store (Key Vault / Parameter Store / Secrets Manager).
8. Image scanned with `trivy` or `grype`: no HIGH/CRITICAL CVEs with a known fix.
9. Image is signed (`cosign`) and the signature is verifiable from the target cluster's admission controller.
10. SBOM is attached to the image.
11. Helm chart passes `helm lint` and `helm template | kubeconform -strict -`.
12. Resource requests and limits are set on every container. No `requests.cpu: 0` or unset memory limit.
13. PodDisruptionBudget exists for the workload if `replicas > 1`.
14. HorizontalPodAutoscaler thresholds are sane (not set to the current steady-state traffic).
15. On-call has been notified via the `#deploys` channel with expected window and change ticket link.
16. Dashboards are identified: service overview, dependency latency, error budget burn rate. Links in the ticket.
17. Alerts for the service are currently silent and not in `flapping` state.
18. SLO targets in the deploy config match the live SLO document (error_rate, p95, p99).
19. Downstream dependencies (DBs, queues, caches) have headroom: DB CPU < 60%, queue depth < 20% of max.
20. No overlapping deploy is scheduled for the same shared dependency.
21. For traffic-affecting changes, a comms message is drafted for `#status` and/or statuspage.
22. If the change touches auth, billing, or PII handling, security review is attached.
23. Load/soak test results from staging are attached (for changes to hot paths).

## During deploy (T zero to rollout complete)

24. Run the deploy from a workstation/CI runner that can reach the cluster control plane and Prometheus.
25. Canary starts at the smallest configured step (typically 5%).
26. SLO gate query is executed after each canary increment, using a 5-minute window.
27. Error rate delta vs. baseline stays under the configured threshold at every step.
28. Saturation signals (CPU, memory, restart count) are observed for new pods, not only request metrics.
29. Log level on new pods is not accidentally set to `DEBUG` in prod.
30. If the SLO gate fails: abort the rollout, run `helm rollback`, confirm pods return to previous revision.
31. Automatic rollback triggers when error_rate > threshold for the full window, not on a single spike.
32. Canary pods are drained gracefully: `terminationGracePeriodSeconds` >= the app's max in-flight request duration.
33. For blue/green: the Service selector flip is atomic; connection draining is honored on the old ReplicaSet.

## Post-deploy (T plus 0 to T plus 24 hours)

34. Smoke tests pass against the production URL (`./scripts/smoke.sh https://...`).
35. Synthetic monitors stay green for at least 15 minutes post-rollout.
36. Error budget burn rate is below the 1x long-window threshold.
37. p95 and p99 latency on the top three endpoints are within 10% of pre-deploy baseline.
38. DB slow-query log shows no new entries tied to the new revision.
39. Queue depth and consumer lag return to steady-state.
40. New feature flag is verified OFF in prod; flip plan is scheduled separately.
41. Change ticket updated with: deployed image digest, Helm revision, start/end UTC timestamps, observed metrics.
42. Deploy note posted to `#deploys` with the same information.
43. If a flag is flipped on post-deploy, repeat steps 34-37 under the new condition.
44. For 24 hours, any alert tagged `service:$SERVICE` goes to the deploying engineer first.
45. Remove any temporary alert silences created during the deploy.

## Abort criteria (any one triggers rollback)

- 5xx rate exceeds SLO threshold for the full evaluation window.
- p95 latency increases by more than 50% vs. pre-deploy baseline.
- Pod restart count > 3 on any new ReplicaSet within 10 minutes.
- `ImagePullBackOff` or `CreateContainerConfigError` on any new pod.
- Dependency alert fires (DB CPU > 80%, queue lag > 5 min) within 10 minutes of rollout.
- A critical customer reports an outage during the deploy window.

---
name: helm-charts
description: Use when a Kubernetes application needs a new Helm chart or a substantial revision to an existing one. Scaffolds Chart.yaml, values.yaml with sensible defaults, and templates for Deployment, Service, Ingress, ConfigMap, and HPA, then validates with helm lint and helm diff against the live cluster.
---

## When to use

- A service is moving from `kubectl apply -f` or kustomize to Helm.
- An existing chart has drifted into copy-paste per environment and needs consolidation.
- Generating a library of internal charts for consistent service shape.

Do not use this skill when the answer is Kustomize + overlays (simpler for small apps) or Argo CD `ApplicationSet` without templating needs.

## Inputs

- `chart_name` — matches the service name (`checkout-api`).
- `app_version` — app semver (`1.4.2`). Chart version (`0.x.y`) is independent and tracks chart changes.
- `image` — default repository, e.g. `ghcr.io/acme/checkout-api`.
- `port` — container port and service port (e.g. `8080`).
- `ingress_host` — optional, e.g. `checkout.staging.acme.com`.
- `enable_hpa` — bool, default `true` for anything that handles user traffic.
- `secrets` — list of keys the app reads from env; the chart emits `ExternalSecret` or reads from a named `Secret`.
- `configmap` — map of non-secret config keys.
- `namespace` — default namespace name.

## Outputs

- A chart directory `charts/<chart_name>/` containing:
  - `Chart.yaml`, `values.yaml`, `values-staging.yaml`, `values-prod.yaml`.
  - `templates/` with `_helpers.tpl`, `deployment.yaml`, `service.yaml`, `ingress.yaml`, `configmap.yaml`, `hpa.yaml`, `serviceaccount.yaml`, `poddisruptionbudget.yaml`, `NOTES.txt`.
  - `.helmignore`, `README.md` (generated with `helm-docs`).
  - `ci/` with sample test values for chart-testing (`ct`).

## Tool dependencies

- `helm` >= 3.12.
- `kubeconform` and/or `kubeval` for schema validation.
- `helm-docs` for README generation.
- `chart-testing` (`ct`) for lint-install-upgrade tests in CI.
- Optional: `helm diff` plugin for live diffing.

## Procedure

### 1. Scaffold

```bash
helm create charts/checkout-api
```

Then rewrite every file — the default scaffold is verbose and dated. Keep only the structure.

### 2. `Chart.yaml`

```yaml
apiVersion: v2
name: checkout-api
description: Checkout API for the storefront
type: application
version: 0.1.0          # chart version; bump on any template change
appVersion: "1.4.2"     # app version; informational
kubeVersion: ">=1.28.0-0"
home: https://github.com/acme/checkout-api
maintainers:
  - name: platform-team
    email: platform@acme.com
```

### 3. `values.yaml` with defaults that pass prod review

```yaml
replicaCount: 2

image:
  repository: ghcr.io/acme/checkout-api
  pullPolicy: IfNotPresent
  tag: ""   # falls back to .Chart.AppVersion
  digest: "" # preferred: pin by digest

imagePullSecrets: []

serviceAccount:
  create: true
  automount: false
  annotations: {}
  name: ""

podAnnotations:
  prometheus.io/scrape: "true"
  prometheus.io/port: "8080"

podSecurityContext:
  runAsNonRoot: true
  runAsUser: 10001
  fsGroup: 10001
  seccompProfile:
    type: RuntimeDefault

securityContext:
  allowPrivilegeEscalation: false
  readOnlyRootFilesystem: true
  capabilities:
    drop: ["ALL"]

service:
  type: ClusterIP
  port: 80
  targetPort: 8080

ingress:
  enabled: false
  className: nginx
  annotations: {}
  hosts: []
  tls: []

resources:
  requests:
    cpu: 100m
    memory: 256Mi
  limits:
    cpu: 1000m
    memory: 512Mi

livenessProbe:
  httpGet: { path: /healthz, port: http }
  initialDelaySeconds: 20
  periodSeconds: 15

readinessProbe:
  httpGet: { path: /ready, port: http }
  initialDelaySeconds: 5
  periodSeconds: 5

startupProbe:
  httpGet: { path: /healthz, port: http }
  failureThreshold: 30
  periodSeconds: 5

autoscaling:
  enabled: true
  minReplicas: 2
  maxReplicas: 10
  targetCPUUtilizationPercentage: 70
  targetMemoryUtilizationPercentage: 80

pdb:
  enabled: true
  minAvailable: 1

config: {}      # rendered into ConfigMap as-is
secretRefs: []  # list of existing Secret names mounted as envFrom

nodeSelector: {}
tolerations: []
affinity:
  podAntiAffinity:
    preferredDuringSchedulingIgnoredDuringExecution:
      - weight: 100
        podAffinityTerm:
          labelSelector:
            matchLabels:
              app.kubernetes.io/name: checkout-api
          topologyKey: kubernetes.io/hostname
```

### 4. `templates/_helpers.tpl`

```gotemplate
{{- define "checkout-api.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end }}

{{- define "checkout-api.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- $name := default .Chart.Name .Values.nameOverride -}}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end }}

{{- define "checkout-api.labels" -}}
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" }}
app.kubernetes.io/name: {{ include "checkout-api.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{- define "checkout-api.selectorLabels" -}}
app.kubernetes.io/name: {{ include "checkout-api.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{- define "checkout-api.image" -}}
{{- $repo := .Values.image.repository -}}
{{- if .Values.image.digest -}}
{{ $repo }}@{{ .Values.image.digest }}
{{- else -}}
{{ $repo }}:{{ .Values.image.tag | default .Chart.AppVersion }}
{{- end -}}
{{- end }}
```

### 5. `templates/deployment.yaml`

```gotemplate
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "checkout-api.fullname" . }}
  labels: {{- include "checkout-api.labels" . | nindent 4 }}
spec:
  {{- if not .Values.autoscaling.enabled }}
  replicas: {{ .Values.replicaCount }}
  {{- end }}
  selector:
    matchLabels: {{- include "checkout-api.selectorLabels" . | nindent 6 }}
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 25%
      maxUnavailable: 0
  template:
    metadata:
      annotations:
        checksum/config: {{ include (print $.Template.BasePath "/configmap.yaml") . | sha256sum }}
        {{- with .Values.podAnnotations }}
        {{- toYaml . | nindent 8 }}
        {{- end }}
      labels: {{- include "checkout-api.selectorLabels" . | nindent 8 }}
    spec:
      serviceAccountName: {{ include "checkout-api.fullname" . }}
      securityContext: {{- toYaml .Values.podSecurityContext | nindent 8 }}
      terminationGracePeriodSeconds: 30
      containers:
        - name: app
          image: {{ include "checkout-api.image" . }}
          imagePullPolicy: {{ .Values.image.pullPolicy }}
          ports:
            - name: http
              containerPort: {{ .Values.service.targetPort }}
              protocol: TCP
          envFrom:
            - configMapRef:
                name: {{ include "checkout-api.fullname" . }}
            {{- range .Values.secretRefs }}
            - secretRef:
                name: {{ . }}
            {{- end }}
          livenessProbe:  {{- toYaml .Values.livenessProbe  | nindent 12 }}
          readinessProbe: {{- toYaml .Values.readinessProbe | nindent 12 }}
          startupProbe:   {{- toYaml .Values.startupProbe   | nindent 12 }}
          resources:      {{- toYaml .Values.resources      | nindent 12 }}
          securityContext: {{- toYaml .Values.securityContext | nindent 12 }}
          volumeMounts:
            - name: tmp
              mountPath: /tmp
      volumes:
        - name: tmp
          emptyDir: {}
      {{- with .Values.nodeSelector }}
      nodeSelector: {{- toYaml . | nindent 8 }}
      {{- end }}
      {{- with .Values.tolerations }}
      tolerations: {{- toYaml . | nindent 8 }}
      {{- end }}
      affinity: {{- toYaml .Values.affinity | nindent 8 }}
```

### 6. `templates/service.yaml`, `ingress.yaml`, `configmap.yaml`, `hpa.yaml`, `pdb.yaml`, `serviceaccount.yaml`

Keep each template under 80 lines; use helpers for repeated metadata.

`hpa.yaml`:

```gotemplate
{{- if .Values.autoscaling.enabled }}
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: {{ include "checkout-api.fullname" . }}
  labels: {{- include "checkout-api.labels" . | nindent 4 }}
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: {{ include "checkout-api.fullname" . }}
  minReplicas: {{ .Values.autoscaling.minReplicas }}
  maxReplicas: {{ .Values.autoscaling.maxReplicas }}
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: {{ .Values.autoscaling.targetCPUUtilizationPercentage }}
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: {{ .Values.autoscaling.targetMemoryUtilizationPercentage }}
{{- end }}
```

`pdb.yaml`:

```gotemplate
{{- if and .Values.pdb.enabled (gt (int .Values.replicaCount) 1) }}
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: {{ include "checkout-api.fullname" . }}
  labels: {{- include "checkout-api.labels" . | nindent 4 }}
spec:
  minAvailable: {{ .Values.pdb.minAvailable }}
  selector:
    matchLabels: {{- include "checkout-api.selectorLabels" . | nindent 6 }}
{{- end }}
```

### 7. Validate

```bash
helm lint charts/checkout-api -f charts/checkout-api/values-prod.yaml
helm template checkout-api charts/checkout-api -f charts/checkout-api/values-prod.yaml \
  | kubeconform -strict -summary -kubernetes-version 1.30.0 -

# Diff against live cluster (requires helm-diff plugin)
helm -n prod diff upgrade checkout-api charts/checkout-api \
  -f charts/checkout-api/values-prod.yaml
```

### 8. CI with `chart-testing`

```bash
ct lint --chart-dirs charts --target-branch main
ct install --chart-dirs charts --target-branch main
```

`ct` spins up a kind cluster, installs the chart, and runs any `templates/tests/*.yaml` Job definitions.

## Examples

### Example 1 — Stateless HTTP service

Input: `chart_name=checkout-api`, `image=ghcr.io/acme/checkout-api`, `port=8080`, `ingress_host=checkout.acme.com`, `enable_hpa=true`, `secrets=["db", "stripe"]`, `configmap={LOG_LEVEL: info}`.

Generates the full chart above; `values-prod.yaml` overrides: `replicaCount: 3`, HPA `min=3, max=20`, `ingress.enabled=true` with the given host and cert-manager annotations, `resources.requests.cpu: 500m`.

### Example 2 — Background worker, no ingress

Input: `chart_name=checkout-worker`, `port=`, `ingress_host=`, `enable_hpa=false`, `secrets=["db", "sqs"]`.

`service.yaml` template is omitted (no port), `ingress.yaml` is skipped, HPA renders with custom metric (SQS queue depth via KEDA `ScaledObject`) instead of CPU. PDB still present. `livenessProbe` uses `exec: ["/app/health"]` since there is no HTTP endpoint.

## Constraints

- Never template a secret value directly; reference an existing `Secret` or `ExternalSecret`.
- Never set `imagePullPolicy: Always` with `tag: latest`; always pin by tag or digest.
- Never omit `resources.requests` — the scheduler and HPA rely on them.
- Never use `hostNetwork`, `hostPID`, `hostIPC`, or `privileged: true` without a written exception.
- Never hardcode namespace inside templates (use `.Release.Namespace`).
- Chart version bumps on any template change; app version bumps on image change.

## Quality checks

- `helm lint` passes with zero warnings across every environment `values-*.yaml`.
- `helm template | kubeconform -strict` passes against the target cluster version.
- `helm diff upgrade` against the live cluster shows only the intended changes.
- Every workload has: `requests` and `limits`, `runAsNonRoot: true`, `readOnlyRootFilesystem: true`, `drop: [ALL]` capabilities, a ServiceAccount of its own.
- `maxUnavailable: 0` on prod rollouts; PDB `minAvailable >= 1` when `replicaCount > 1`.
- `checksum/config` annotation on the Deployment so ConfigMap changes trigger a rollout.
- `helm-docs` regenerated; `README.md` table of values is current.

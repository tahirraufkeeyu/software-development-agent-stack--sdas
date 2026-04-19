# Azure DevOps Pipeline Patterns

Reusable YAML snippets for the `pipeline-builder` skill when targeting Azure DevOps Pipelines.

## Multi-stage pipeline skeleton

```yaml
trigger:
  branches:
    include: [main]
  paths:
    exclude: [docs/*, '*.md']

pr:
  branches:
    include: ['*']

variables:
  - group: checkout-api-common
  - name: imageName
    value: checkout-api

stages:
  - stage: Validate
    displayName: Lint and test
    jobs:
      - template: pipelines/templates/node-ci.yml
        parameters:
          nodeVersion: '20.x'
          workDir: $(Build.SourcesDirectory)

  - stage: Build
    dependsOn: Validate
    jobs:
      - template: pipelines/templates/container-build.yml
        parameters:
          imageName: $(imageName)
          acrServiceConnection: acme-acr

  - stage: DeployStaging
    dependsOn: Build
    condition: and(succeeded(), eq(variables['Build.SourceBranch'], 'refs/heads/main'))
    jobs:
      - deployment: staging
        environment: staging
        strategy:
          runOnce:
            deploy:
              steps:
                - template: pipelines/templates/k8s-deploy.yml
                  parameters:
                    environment: staging
                    kubeServiceConnection: aks-staging

  - stage: DeployProd
    dependsOn: DeployStaging
    jobs:
      - deployment: prod
        environment: production
        strategy:
          canary:
            increments: [5, 25, 50, 100]
            deploy:
              steps:
                - template: pipelines/templates/k8s-deploy.yml
                  parameters:
                    environment: prod
                    kubeServiceConnection: aks-prod
```

Approval gates are configured on the `production` environment in the ADO UI (Environment -> Approvals and checks).

## Template: Node CI job

`pipelines/templates/node-ci.yml`:

```yaml
parameters:
  - name: nodeVersion
    type: string
    default: '20.x'
  - name: workDir
    type: string
    default: $(Build.SourcesDirectory)

jobs:
  - job: NodeCI
    displayName: Lint + test
    pool:
      vmImage: ubuntu-latest
    steps:
      - task: Cache@2
        inputs:
          key: 'pnpm | "$(Agent.OS)" | pnpm-lock.yaml'
          restoreKeys: |
            pnpm | "$(Agent.OS)"
          path: $(Pipeline.Workspace)/.pnpm-store

      - task: NodeTool@0
        inputs:
          versionSpec: ${{ parameters.nodeVersion }}

      - script: |
          corepack enable
          corepack prepare pnpm@9 --activate
          pnpm config set store-dir $(Pipeline.Workspace)/.pnpm-store
          pnpm install --frozen-lockfile
        workingDirectory: ${{ parameters.workDir }}
        displayName: Install deps

      - script: pnpm run lint
        workingDirectory: ${{ parameters.workDir }}

      - script: pnpm run test -- --reporter=junit --reporter-option output=$(Common.TestResultsDirectory)/junit.xml
        workingDirectory: ${{ parameters.workDir }}

      - task: PublishTestResults@2
        condition: always()
        inputs:
          testResultsFiles: $(Common.TestResultsDirectory)/junit.xml
          testResultsFormat: JUnit
```

## Template: Container build (ACR)

`pipelines/templates/container-build.yml`:

```yaml
parameters:
  - name: imageName
    type: string
  - name: acrServiceConnection
    type: string

jobs:
  - job: BuildImage
    pool:
      vmImage: ubuntu-latest
    steps:
      - task: Docker@2
        displayName: Login to ACR
        inputs:
          command: login
          containerRegistry: ${{ parameters.acrServiceConnection }}

      - task: Docker@2
        displayName: Build and push
        inputs:
          command: buildAndPush
          repository: ${{ parameters.imageName }}
          Dockerfile: Dockerfile
          containerRegistry: ${{ parameters.acrServiceConnection }}
          tags: |
            $(Build.SourceVersion)
            sha-$(Build.SourceVersion)
            latest

      - script: |
          echo "##vso[task.setvariable variable=imageDigest;isOutput=true]$(docker inspect --format='{{index .RepoDigests 0}}' ${{ parameters.imageName }}:$(Build.SourceVersion))"
        name: digest
```

## Template: k8s deploy

`pipelines/templates/k8s-deploy.yml`:

```yaml
parameters:
  - name: environment
    type: string
  - name: kubeServiceConnection
    type: string

steps:
  - task: HelmInstaller@1
    inputs:
      helmVersionToInstall: latest

  - task: KubernetesManifest@1
    displayName: Helm upgrade
    inputs:
      action: deploy
      kubernetesServiceConnection: ${{ parameters.kubeServiceConnection }}
      namespace: ${{ parameters.environment }}
      manifests: |
        $(Pipeline.Workspace)/charts/checkout-api/templates/*.yaml
      containers: $(imageName):$(Build.SourceVersion)

  - script: |
      kubectl -n ${{ parameters.environment }} rollout status deploy/checkout-api --timeout=5m
    displayName: Wait for rollout
```

## Service connections

Service connections are created in `Project Settings -> Service connections`. For this pipeline you need:

- `acme-acr` — Docker Registry service connection to the ACR.
- `aks-staging`, `aks-prod` — Kubernetes service connections to each AKS cluster. Prefer workload identity federation (OIDC) over kubeconfig secrets.
- `azure-key-vault` — Azure Resource Manager service connection used by the Key Vault task.

Lock each service connection to specific pipelines (Edit -> Security -> remove "Open access for all pipelines").

## Variable groups + Key Vault

```yaml
variables:
  - group: checkout-api-common          # plaintext variables
  - group: checkout-api-secrets         # linked to Key Vault
```

The `checkout-api-secrets` variable group is configured as "Link secrets from an Azure key vault as variables" in the Library UI, targeting `kv-acme-prod`. Only named secrets are pulled; rotate in Key Vault and the next run picks them up.

In steps, reference as `$(SECRET_NAME)`. Secrets are masked in logs automatically.

## Environments with checks

Configure in the UI on each environment:

- **Approvals** — required reviewers (e.g. `@sre-team`), minimum approvals `1`, timeout `24h`.
- **Business hours** — restrict prod deploys to a time window.
- **Exclusive lock** — only one deploy at a time.
- **Invoke REST API** — call a change-management system to record the deploy.
- **Branch control** — only allow `refs/heads/main`.

## Self-hosted agents

```yaml
pool:
  name: acme-linux-pool
  demands:
    - docker
    - kubectl
```

Agent lifecycle lives in Terraform (VMSS or AKS-hosted) — see `iac-generator` reference. Avoid manual VMs.

## Pipeline caching

```yaml
- task: Cache@2
  inputs:
    key: 'go | "$(Agent.OS)" | go.sum'
    path: $(Pipeline.Workspace)/.cache/go-build
    restoreKeys: |
      go | "$(Agent.OS)"
```

Cache keys must include the lockfile hash. Never cache `node_modules`; cache the package manager store (`.pnpm-store`, `~/.npm`, `~/.cache/pip`).

## Container jobs

Run a job inside a container instead of on the VM:

```yaml
jobs:
  - job: build
    pool:
      vmImage: ubuntu-latest
    container:
      image: mcr.microsoft.com/dotnet/sdk:8.0
    steps:
      - script: dotnet test --logger "trx;LogFileName=test.trx"
```

Useful for reproducible builds without installing toolchains on the agent.

# GitHub Actions Patterns

Reusable snippets for the `pipeline-builder` skill when targeting GitHub Actions. All third-party actions are pinned by commit SHA; replace with current SHAs at generation time.

## Test + lint matrix (Node)

```yaml
name: ci
on:
  pull_request:
  push:
    branches: [main]

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

permissions:
  contents: read

jobs:
  test:
    strategy:
      fail-fast: false
      matrix:
        os: [ubuntu-latest]
        node: [18, 20]
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2
      - uses: pnpm/action-setup@a7487c7e89a18df4991f7f222e4898a00d66ddda # v4.1.0
        with:
          version: 9
      - uses: actions/setup-node@39370e3970a6d050c480ffad4ff0ed4d3fdee5af # v4.1.0
        with:
          node-version: ${{ matrix.node }}
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm run lint
      - run: pnpm run test --coverage
      - uses: actions/upload-artifact@b4b15b8c7c6ac21ea08fcf65892d2ee8f75cf882 # v4.4.3
        if: always()
        with:
          name: coverage-node-${{ matrix.node }}
          path: coverage/
          retention-days: 7
```

## Test + lint matrix (Python)

```yaml
jobs:
  test:
    strategy:
      matrix:
        python: ["3.11", "3.12"]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2
      - uses: astral-sh/setup-uv@v3
        with:
          enable-cache: true
          cache-dependency-glob: uv.lock
      - run: uv python install ${{ matrix.python }}
      - run: uv sync --frozen
      - run: uv run ruff check .
      - run: uv run pytest -q --junitxml=reports/junit.xml
      - uses: actions/upload-artifact@b4b15b8c7c6ac21ea08fcf65892d2ee8f75cf882 # v4.4.3
        with:
          name: junit-${{ matrix.python }}
          path: reports/junit.xml
```

## Build + push container to GHCR

```yaml
jobs:
  build-image:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
      id-token: write
    steps:
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2
      - uses: docker/setup-buildx-action@c47758b77c9736f4b2ef4073d4d51994fabfe349 # v3.7.1
      - uses: docker/login-action@9780b0c442fbb1117ed29e0efdff1e18412f7567 # v3.3.0
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - uses: docker/metadata-action@369eb591f429131d6889c46b94e711f089e6ca96 # v5.6.1
        id: meta
        with:
          images: ghcr.io/${{ github.repository }}
          tags: |
            type=sha,prefix=sha-,format=short
            type=semver,pattern={{version}}
            type=ref,event=branch
      - uses: docker/build-push-action@4f58ea79222b3b9dc2c8bbdd6debcef730109a75 # v6.9.0
        with:
          context: .
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
          provenance: true
          sbom: true
      - uses: sigstore/cosign-installer@4959ce089c2fe0a9b8e1b5e7e9b4dc4e06c5a2bc # v3.7.0
      - run: cosign sign --yes ghcr.io/${{ github.repository }}@${{ steps.meta.outputs.digest }}
```

## Deploy to EKS via OIDC (no long-lived keys)

```yaml
name: deploy-prod
on:
  workflow_dispatch:
    inputs:
      image_digest:
        required: true

permissions:
  id-token: write
  contents: read

jobs:
  deploy:
    environment:
      name: production
      url: https://checkout.acme.example
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2
      - uses: aws-actions/configure-aws-credentials@e3dd6a429d7300a6a4c196c26e071d42e0343502 # v4.0.2
        with:
          role-to-assume: arn:aws:iam::123456789012:role/gha-deploy-checkout
          aws-region: us-east-1
      - run: aws eks update-kubeconfig --name prod-us-east-1
      - uses: azure/setup-helm@fe7b79cd5ee1e45176fcad797de68ecaf3ca4814 # v4.2.0
      - run: |
          helm -n prod upgrade --install checkout-api ./charts/checkout-api \
            -f ./charts/checkout-api/values-prod.yaml \
            --set image.digest="${{ inputs.image_digest }}" \
            --atomic --timeout 10m --wait
      - run: kubectl -n prod rollout status deploy/checkout-api --timeout=5m
```

Trust policy on `arn:aws:iam::...:role/gha-deploy-checkout` must restrict `sub` to `repo:acme/checkout-api:environment:production`.

## Semantic release

```yaml
name: release
on:
  push:
    branches: [main]

permissions:
  contents: write
  issues: write
  pull-requests: write
  packages: write
  id-token: write

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2
        with:
          fetch-depth: 0
          persist-credentials: false
      - uses: actions/setup-node@39370e3970a6d050c480ffad4ff0ed4d3fdee5af # v4.1.0
        with: { node-version: 20, cache: pnpm }
      - uses: pnpm/action-setup@a7487c7e89a18df4991f7f222e4898a00d66ddda # v4.1.0
        with: { version: 9 }
      - run: pnpm install --frozen-lockfile
      - run: pnpm dlx semantic-release
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

## Path filters for monorepo

```yaml
on:
  pull_request:
    paths:
      - "services/api/**"
      - ".github/workflows/api-ci.yml"
      - "pnpm-lock.yaml"

jobs:
  changes:
    runs-on: ubuntu-latest
    outputs:
      api: ${{ steps.filter.outputs.api }}
      worker: ${{ steps.filter.outputs.worker }}
    steps:
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2
      - uses: dorny/paths-filter@de90cc6fb38fc0963ad72b210f1f284cd68cea36 # v3.0.2
        id: filter
        with:
          filters: |
            api:
              - 'services/api/**'
            worker:
              - 'services/worker/**'

  test-api:
    needs: changes
    if: needs.changes.outputs.api == 'true'
    uses: ./.github/workflows/reusable-node-ci.yml
    with:
      workdir: services/api
```

## Reusable workflow

`.github/workflows/reusable-node-ci.yml`:

```yaml
on:
  workflow_call:
    inputs:
      workdir:
        required: true
        type: string
      node-version:
        required: false
        type: string
        default: "20"
    secrets:
      NPM_TOKEN:
        required: false

jobs:
  ci:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: ${{ inputs.workdir }}
    steps:
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2
      - uses: pnpm/action-setup@a7487c7e89a18df4991f7f222e4898a00d66ddda # v4.1.0
        with: { version: 9 }
      - uses: actions/setup-node@39370e3970a6d050c480ffad4ff0ed4d3fdee5af # v4.1.0
        with:
          node-version: ${{ inputs.node-version }}
          cache: pnpm
          cache-dependency-path: ${{ inputs.workdir }}/pnpm-lock.yaml
      - run: pnpm install --frozen-lockfile
      - run: pnpm run lint && pnpm run test
```

Caller:

```yaml
jobs:
  api:
    uses: ./.github/workflows/reusable-node-ci.yml
    with:
      workdir: services/api
```

## Environments with required reviewers

```bash
gh api -X PUT repos/$OWNER/$REPO/environments/production \
  -f 'wait_timer=0' \
  -f 'prevent_self_review=true' \
  -F 'reviewers[][type]=Team' -F "reviewers[][id]=$SRE_TEAM_ID" \
  -F 'deployment_branch_policy[protected_branches]=true' \
  -F 'deployment_branch_policy[custom_branch_policies]=false'
```

In the workflow:

```yaml
jobs:
  deploy-prod:
    environment:
      name: production
      url: https://checkout.acme.example
```

Prod deploys now require approval from the SRE team and can only run from protected branches.

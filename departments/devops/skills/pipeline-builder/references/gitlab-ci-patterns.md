# GitLab CI Patterns

Reusable `.gitlab-ci.yml` snippets for the `pipeline-builder` skill when targeting GitLab CI.

## Top-level skeleton

```yaml
stages: [lint, test, build, scan, publish, deploy]

default:
  image: alpine:3.20
  tags: [acme-shared]
  interruptible: true

variables:
  DOCKER_BUILDKIT: "1"
  PNPM_STORE: "$CI_PROJECT_DIR/.pnpm-store"

workflow:
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
    - if: $CI_COMMIT_TAG

include:
  - local: ci/node.yml
  - local: ci/container.yml
  - local: ci/deploy.yml
  - template: Security/SAST.gitlab-ci.yml
  - template: Security/Dependency-Scanning.gitlab-ci.yml
```

## `rules:` vs `only/except`

Prefer `rules:` — `only/except` is legacy.

```yaml
test:
  stage: test
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
      changes:
        - services/api/**/*
        - pnpm-lock.yaml
    - when: never
```

`rules:` compose path filters, event source, and branch in one place. Every job should end with a `when: never` or explicit fall-through to avoid surprise pipelines.

## Node test job with cache

`ci/node.yml`:

```yaml
.node:
  image: node:20-alpine
  before_script:
    - corepack enable
    - corepack prepare pnpm@9 --activate
    - pnpm config set store-dir $PNPM_STORE
  cache:
    key:
      files:
        - pnpm-lock.yaml
    paths:
      - .pnpm-store

lint:node:
  extends: .node
  stage: lint
  script:
    - pnpm install --frozen-lockfile
    - pnpm run lint

test:node:
  extends: .node
  stage: test
  needs: ["lint:node"]
  script:
    - pnpm install --frozen-lockfile
    - pnpm run test -- --reporter=junit --reporter-options output=reports/junit.xml
  artifacts:
    when: always
    reports:
      junit: reports/junit.xml
    expire_in: 7 days
```

## `needs:` for DAG parallelism

```yaml
build:api:
  stage: build
  needs: ["test:api"]
  script: ./scripts/build.sh services/api

build:worker:
  stage: build
  needs: ["test:worker"]
  script: ./scripts/build.sh services/worker
```

`needs:` lets `build:api` start as soon as `test:api` finishes, regardless of `test:worker`. Without it, all of `test` must complete before any `build` runs.

## Cache vs artifacts

- **Cache** — best-effort, shared across runs. Use for package manager stores, compiled-but-non-deterministic output. Key on the lockfile.
- **Artifacts** — deterministic output passed to later jobs or retained for humans. Use `expire_in` to cap storage.

```yaml
build:image:
  stage: build
  artifacts:
    paths: [dist/]
    expire_in: 1 week
  cache:
    key: { files: [package-lock.json] }
    paths: [node_modules/]
    policy: pull
```

`policy: pull` prevents the cache from being re-uploaded by a job that only reads it.

## Container build + push

`ci/container.yml`:

```yaml
build:container:
  stage: build
  image: docker:27
  services:
    - name: docker:27-dind
      alias: docker
  variables:
    DOCKER_HOST: tcp://docker:2376
    DOCKER_TLS_CERTDIR: "/certs"
  before_script:
    - docker login -u "$CI_REGISTRY_USER" -p "$CI_REGISTRY_PASSWORD" "$CI_REGISTRY"
  script:
    - TAG="$CI_REGISTRY_IMAGE:sha-$CI_COMMIT_SHORT_SHA"
    - docker buildx build --push --provenance=true --sbom=true
        --cache-from "type=registry,ref=$CI_REGISTRY_IMAGE:buildcache"
        --cache-to   "type=registry,ref=$CI_REGISTRY_IMAGE:buildcache,mode=max"
        -t "$TAG" -t "$CI_REGISTRY_IMAGE:latest" .
    - echo "IMAGE=$TAG" >> image.env
  artifacts:
    reports:
      dotenv: image.env
```

## Deploy with environments and auto-stop

`ci/deploy.yml`:

```yaml
.deploy:
  image: alpine/k8s:1.30.0
  before_script:
    - echo "$KUBECONFIG_B64" | base64 -d > /tmp/kubeconfig
    - export KUBECONFIG=/tmp/kubeconfig

deploy:review:
  extends: .deploy
  stage: deploy
  environment:
    name: review/$CI_COMMIT_REF_SLUG
    url: https://$CI_COMMIT_REF_SLUG.review.acme.com
    on_stop: stop:review
    auto_stop_in: 1 day
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
  script:
    - helm -n review upgrade --install "checkout-$CI_COMMIT_REF_SLUG" ./charts/checkout-api
        --set image.tag=sha-$CI_COMMIT_SHORT_SHA
        --atomic --timeout 5m --wait

stop:review:
  extends: .deploy
  stage: deploy
  environment:
    name: review/$CI_COMMIT_REF_SLUG
    action: stop
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
      when: manual
  script:
    - helm -n review uninstall "checkout-$CI_COMMIT_REF_SLUG"

deploy:prod:
  extends: .deploy
  stage: deploy
  environment:
    name: production
    url: https://checkout.acme.com
  rules:
    - if: $CI_COMMIT_TAG
      when: manual
  script:
    - helm -n prod upgrade --install checkout-api ./charts/checkout-api
        -f ./charts/checkout-api/values-prod.yaml
        --set image.tag=$CI_COMMIT_TAG --atomic --timeout 10m --wait
```

Review apps auto-stop after a day so merged/abandoned MRs don't leave clusters full.

## Merge-request pipelines

```yaml
workflow:
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
    - if: $CI_PIPELINE_SOURCE == "push" && $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
    - if: $CI_COMMIT_TAG
```

This combination produces MR pipelines on open/update, a pipeline on merge to `main`, and a pipeline on tag. It also avoids "detached" pipelines on feature branches that have an open MR (GitLab dedupes automatically when `merge_request_event` matches).

## `include:` patterns

```yaml
include:
  - project: 'acme/ci-templates'
    ref: v2.3.1
    file: '/templates/node.yml'
  - template: Security/SAST.gitlab-ci.yml
  - local: ci/deploy.yml
```

Pin `ref:` to a tag, not `main`, so pipeline behavior does not change under you.

## Protected variables and OIDC

- Mark prod credentials as **Protected** and **Masked** in Settings -> CI/CD -> Variables. They will only be injected into jobs running on protected branches/tags.
- Prefer OIDC over long-lived cloud credentials. Example for AWS:

```yaml
deploy:prod:
  id_tokens:
    AWS_ID_TOKEN:
      aud: https://gitlab.com
  script:
    - >
      aws sts assume-role-with-web-identity
      --role-arn "$AWS_ROLE_ARN"
      --role-session-name "gitlab-$CI_JOB_ID"
      --web-identity-token "$AWS_ID_TOKEN"
```

The IAM trust policy restricts `sub` to `project_path:acme/checkout-api:ref_type:branch:ref:main`.

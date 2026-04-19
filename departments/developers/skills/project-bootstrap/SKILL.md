---
name: project-bootstrap
description: Use when the user asks to scaffold a new project, start a repo from scratch, or set up a greenfield service in TypeScript/Node, Python/FastAPI, Go, or Rust. Produces a working layout with linting, formatting, tests, pre-commit hooks, GitHub Actions CI, a Dockerfile, a .gitignore, a README skeleton, and a license file.
safety: writes-local
---

## When to use

- User says "start a new project", "scaffold a service", "bootstrap a repo".
- User wants to convert a single-file prototype into a proper package.
- User wants to standardise a team repo layout.

Do not use this skill to add a feature to an existing project or to migrate between stacks — those require narrower changes.

## Inputs

- Stack: one of `ts-node`, `py-fastapi`, `go`, `rust`.
- Project name (used for package name, module path, CLI binary).
- Optional: license (`MIT`, `Apache-2.0`, `BSD-3-Clause`, proprietary). Default `MIT`.
- Optional: CI provider (`github` default), container target (`alpine` or `distroless`).
- Optional: author/org for license and package metadata.

## Outputs

A directory tree for the chosen stack with these always present:

- Formatter config (prettier / black+isort / gofmt+goimports / rustfmt).
- Linter config (eslint / ruff / golangci-lint / clippy).
- Test harness and a smoke test.
- Pre-commit hook config (`.pre-commit-config.yaml` or equivalent).
- GitHub Actions workflow running lint, type-check, test on PRs.
- `.gitignore` tailored to the stack.
- `README.md` skeleton (see `documentation` skill).
- License file.
- Dockerfile (multi-stage, non-root, pinned base image).
- `.editorconfig` and `.gitattributes`.

## Tool dependencies

- Write / Edit for file creation.
- Bash for the user to run `git init`, `npm init -y`, etc. Do not invoke tools that mutate their environment unless the user asks.
- See [references/stack-templates.md](references/stack-templates.md) for exact config snippets per stack.

## Procedure

1. Confirm inputs. If the stack is ambiguous, ask. If a target directory exists and is non-empty, refuse to overwrite without explicit confirmation.
2. Create the directory tree for the stack:

   - `ts-node`: `src/`, `src/index.ts`, `tests/`, `package.json`, `tsconfig.json`, `.eslintrc.cjs`, `.prettierrc`, `vitest.config.ts`.
   - `py-fastapi`: `src/<pkg>/`, `src/<pkg>/__init__.py`, `src/<pkg>/main.py`, `tests/`, `tests/test_smoke.py`, `pyproject.toml`.
   - `go`: `cmd/<name>/main.go`, `internal/`, `go.mod`, `Makefile`.
   - `rust`: `src/main.rs` or `src/lib.rs`, `Cargo.toml`, `rustfmt.toml`, `clippy.toml`.

3. Write the files using the exact snippets in [references/stack-templates.md](references/stack-templates.md), substituting the project name and license.
4. Add the common files across all stacks: `.gitignore`, `.editorconfig`, `.gitattributes`, `LICENSE`, `README.md`, `Dockerfile`, `.github/workflows/ci.yml`, `.pre-commit-config.yaml`, `CHANGELOG.md` seed.
5. Add a smoke test that exercises the entry point and is wired into CI. A repo with passing CI on commit #1 is the bar.
6. Print the next-steps block: init git, install deps, run tests, run lint, install pre-commit hooks, open in the IDE.

## Examples

### Happy path: TypeScript/Node service named "inv-api"

Tree (abbreviated):

```
inv-api/
  src/
    index.ts
    server.ts
  tests/
    server.test.ts
  package.json
  tsconfig.json
  .eslintrc.cjs
  .prettierrc
  vitest.config.ts
  .editorconfig
  .gitignore
  .gitattributes
  LICENSE
  README.md
  Dockerfile
  .github/workflows/ci.yml
  .pre-commit-config.yaml
```

`src/index.ts`:

```ts
import { createServer } from './server';

const port = Number(process.env.PORT ?? 3000);
createServer().listen(port, () => console.log(`listening on :${port}`));
```

`src/server.ts`:

```ts
import express from 'express';
export function createServer() {
  const app = express();
  app.get('/healthz', (_req, res) => res.json({ status: 'ok' }));
  return app;
}
```

`tests/server.test.ts`:

```ts
import request from 'supertest';
import { createServer } from '../src/server';

it('GET /healthz returns ok', async () => {
  const res = await request(createServer()).get('/healthz');
  expect(res.status).toBe(200);
  expect(res.body).toEqual({ status: 'ok' });
});
```

Next-steps block:

```
git init && git add -A && git commit -m "chore: scaffold inv-api"
pnpm install
pnpm test
pnpm lint
pre-commit install
```

### Edge case: Python FastAPI with a library layout

User asked for `py-fastapi` with package name `reporting_api`, Apache-2.0 license, distroless container.

Tree:

```
reporting-api/
  src/reporting_api/
    __init__.py
    main.py
    deps.py
  tests/
    test_smoke.py
    conftest.py
  pyproject.toml
  ruff.toml
  .editorconfig
  .gitignore
  .gitattributes
  LICENSE            # Apache-2.0
  NOTICE
  README.md
  Dockerfile         # multi-stage, gcr.io/distroless/python3-debian12
  .github/workflows/ci.yml
  .pre-commit-config.yaml
```

Smoke test exercises `/healthz` via `httpx.AsyncClient` and `TestClient`; CI runs `ruff check`, `ruff format --check`, `pyright`, `pytest -q`.

## Constraints

- Never scaffold into a non-empty directory without explicit confirmation.
- Never pin tool versions to "latest"; pin to a concrete version and note it.
- Never write secrets into `.env`; write `.env.example` with placeholder values.
- Never commit generated artifacts (`dist/`, `target/`, `node_modules/`, `.venv/`, `__pycache__/`) — `.gitignore` must exclude them.
- Never drop the license. Default to MIT if the user does not choose.
- Do not add optional dependencies "in case you need them"; start minimal.
- Do not set up CI steps that cannot run on commit #1 (do not require external secrets for the initial workflow).

## Quality checks

- `git init && <install deps> && <test> && <lint> && <build>` all succeed on a clean clone.
- CI workflow runs lint, type-check, and tests, and reports green on the initial commit.
- Dockerfile builds and the resulting image passes the smoke test.
- Pre-commit hooks install and run clean against the initial tree.
- `.gitignore` excludes all generated artifacts for the stack.
- License file matches the chosen SPDX identifier exactly.
- README quickstart matches the scripts in the manifest.

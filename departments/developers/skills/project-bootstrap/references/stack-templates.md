# Stack templates

Ready-to-use config snippets. Copy verbatim; substitute `<name>`, `<author>`, `<year>`, `<spdx>`.

## TypeScript / Node

### `package.json`

```json
{
  "name": "<name>",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "engines": { "node": ">=20.11" },
  "packageManager": "pnpm@9.12.0",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "start": "node dist/index.js",
    "dev": "tsx watch src/index.ts",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint .",
    "lint:fix": "eslint . --fix",
    "format": "prettier --check .",
    "format:fix": "prettier --write .",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "dependencies": { "express": "^4.21.1" },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/node": "^20.12.12",
    "@typescript-eslint/eslint-plugin": "^8.8.1",
    "@typescript-eslint/parser": "^8.8.1",
    "eslint": "^9.12.0",
    "eslint-config-prettier": "^9.1.0",
    "prettier": "^3.3.3",
    "supertest": "^7.0.0",
    "tsx": "^4.19.1",
    "typescript": "^5.6.2",
    "vitest": "^2.1.2"
  }
}
```

### `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["dist", "node_modules", "tests"]
}
```

### `.eslintrc.cjs`

```js
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: { project: './tsconfig.json', tsconfigRootDir: __dirname },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended-type-checked',
    'prettier',
  ],
  env: { node: true, es2022: true },
  rules: {
    '@typescript-eslint/no-floating-promises': 'error',
    '@typescript-eslint/no-misused-promises': 'error',
    '@typescript-eslint/consistent-type-imports': 'error',
    'no-console': ['warn', { allow: ['warn', 'error'] }],
  },
  ignorePatterns: ['dist', 'node_modules', 'coverage'],
};
```

### `.prettierrc`

```json
{ "singleQuote": true, "trailingComma": "all", "printWidth": 100 }
```

### `vitest.config.ts`

```ts
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: { provider: 'v8', reporter: ['text', 'lcov'], thresholds: { lines: 80, functions: 80, branches: 70, statements: 80 } },
  },
});
```

## Python / FastAPI

### `pyproject.toml`

```toml
[project]
name = "<name>"
version = "0.1.0"
description = "<one-line description>"
readme = "README.md"
requires-python = ">=3.11"
license = { text = "<spdx>" }
authors = [{ name = "<author>" }]
dependencies = [
  "fastapi>=0.115,<0.116",
  "uvicorn[standard]>=0.30,<0.31",
  "pydantic>=2.8,<3",
]

[project.optional-dependencies]
dev = [
  "pytest>=8.3,<9",
  "pytest-asyncio>=0.23,<0.24",
  "httpx>=0.27,<0.28",
  "ruff>=0.6,<0.7",
  "pyright>=1.1.380,<2",
  "coverage[toml]>=7.6,<8",
]

[build-system]
requires = ["hatchling>=1.25"]
build-backend = "hatchling.build"

[tool.hatch.build.targets.wheel]
packages = ["src/<pkg>"]

[tool.ruff]
line-length = 100
src = ["src", "tests"]
[tool.ruff.lint]
select = ["E", "F", "I", "B", "UP", "SIM", "N", "S", "RUF"]
ignore = ["S101"]  # allow assert in tests
[tool.ruff.lint.per-file-ignores]
"tests/**" = ["S101", "S105", "S106"]

[tool.pyright]
include = ["src", "tests"]
strict = ["src/<pkg>"]
pythonVersion = "3.11"
reportMissingTypeStubs = false

[tool.pytest.ini_options]
addopts = "-q --strict-markers"
asyncio_mode = "auto"
testpaths = ["tests"]

[tool.coverage.run]
branch = true
source = ["src/<pkg>"]
[tool.coverage.report]
fail_under = 80
show_missing = true
```

### `src/<pkg>/main.py`

```python
from fastapi import FastAPI

def create_app() -> FastAPI:
    app = FastAPI(title="<name>")

    @app.get("/healthz")
    def healthz() -> dict[str, str]:
        return {"status": "ok"}

    return app

app = create_app()
```

### `tests/test_smoke.py`

```python
from fastapi.testclient import TestClient
from <pkg>.main import create_app

def test_healthz() -> None:
    client = TestClient(create_app())
    response = client.get("/healthz")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
```

## Go

### `go.mod`

```
module github.com/<org>/<name>

go 1.23
```

### `cmd/<name>/main.go`

```go
package main

import (
    "encoding/json"
    "log"
    "net/http"
    "os"
)

func main() {
    mux := http.NewServeMux()
    mux.HandleFunc("/healthz", func(w http.ResponseWriter, _ *http.Request) {
        w.Header().Set("Content-Type", "application/json")
        _ = json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
    })

    addr := ":" + getenv("PORT", "8080")
    log.Printf("listening on %s", addr)
    if err := http.ListenAndServe(addr, mux); err != nil {
        log.Fatal(err)
    }
}

func getenv(k, d string) string { if v, ok := os.LookupEnv(k); ok { return v }; return d }
```

### `.golangci.yml`

```yaml
run:
  timeout: 3m
linters:
  disable-all: true
  enable:
    - errcheck
    - gofmt
    - goimports
    - govet
    - ineffassign
    - staticcheck
    - unused
    - revive
    - gosec
    - bodyclose
    - errorlint
linters-settings:
  revive:
    rules:
      - { name: exported }
      - { name: var-naming }
      - { name: context-as-argument }
      - { name: error-return }
issues:
  exclude-dirs: [vendor]
```

### `Makefile`

```makefile
.PHONY: test lint fmt build run

test:
	go test ./... -race -count=1 -cover

lint:
	golangci-lint run

fmt:
	gofmt -s -w .
	goimports -w .

build:
	CGO_ENABLED=0 go build -trimpath -ldflags='-s -w' -o bin/<name> ./cmd/<name>

run:
	go run ./cmd/<name>
```

## Rust

### `Cargo.toml`

```toml
[package]
name = "<name>"
version = "0.1.0"
edition = "2021"
rust-version = "1.80"
license = "<spdx>"
description = "<one-line description>"

[dependencies]
axum = "0.7"
tokio = { version = "1", features = ["rt-multi-thread", "macros"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["env-filter"] }

[dev-dependencies]
tower = "0.5"
reqwest = { version = "0.12", features = ["json"] }

[profile.release]
lto = "thin"
codegen-units = 1
strip = "symbols"
```

### `rustfmt.toml`

```toml
edition = "2021"
max_width = 100
newline_style = "Unix"
use_field_init_shorthand = true
use_try_shorthand = true
```

### `clippy.toml`

```toml
avoid-breaking-exported-api = false
```

### `src/main.rs`

```rust
use axum::{routing::get, Json, Router};
use serde_json::{json, Value};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::fmt().with_env_filter("info").init();
    let app = Router::new().route("/healthz", get(healthz));
    let listener = tokio::net::TcpListener::bind("0.0.0.0:8080").await?;
    tracing::info!("listening on 0.0.0.0:8080");
    axum::serve(listener, app).await?;
    Ok(())
}

async fn healthz() -> Json<Value> { Json(json!({"status": "ok"})) }
```

## Common files

### `.gitignore` (composed by stack)

```
# editors
.idea/
.vscode/
*.swp
.DS_Store

# env
.env
.env.local
.env.*.local

# node
node_modules/
dist/
coverage/
.pnpm-store/

# python
__pycache__/
*.py[cod]
.venv/
.pytest_cache/
.ruff_cache/
.coverage
htmlcov/
build/
dist/

# go
bin/
vendor/

# rust
target/

# docker
*.pid
```

### `.editorconfig`

```
root = true

[*]
indent_style = space
indent_size = 2
end_of_line = lf
charset = utf-8
trim_trailing_whitespace = true
insert_final_newline = true

[*.{py,go,rs}]
indent_size = 4

[Makefile]
indent_style = tab
```

### `.gitattributes`

```
* text=auto eol=lf
*.png binary
*.jpg binary
*.pdf binary
```

### `.pre-commit-config.yaml`

```yaml
repos:
  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v5.0.0
    hooks:
      - id: end-of-file-fixer
      - id: trailing-whitespace
      - id: check-yaml
      - id: check-added-large-files
        args: ["--maxkb=512"]
      - id: check-merge-conflict
  - repo: https://github.com/gitleaks/gitleaks
    rev: v8.18.4
    hooks:
      - id: gitleaks
  # Stack-specific hooks (enable the relevant block):
  # TypeScript:
  # - repo: local
  #   hooks:
  #     - { id: eslint, name: eslint, entry: pnpm exec eslint, language: system, types: [ts], pass_filenames: true }
  #     - { id: prettier, name: prettier, entry: pnpm exec prettier --check, language: system, types_or: [ts, json, yaml, markdown], pass_filenames: true }
  # Python:
  # - repo: https://github.com/astral-sh/ruff-pre-commit
  #   rev: v0.6.9
  #   hooks: [ { id: ruff }, { id: ruff-format } ]
  # Go:
  # - repo: https://github.com/golangci/golangci-lint
  #   rev: v1.61.0
  #   hooks: [ { id: golangci-lint } ]
  # Rust:
  # - repo: local
  #   hooks:
  #     - { id: cargo-fmt, name: cargo fmt, entry: cargo fmt --check, language: system, pass_filenames: false }
  #     - { id: clippy, name: clippy, entry: cargo clippy -- -D warnings, language: system, pass_filenames: false }
```

### `.github/workflows/ci.yml` (TypeScript example — adapt per stack)

```yaml
name: ci
on:
  pull_request:
  push: { branches: [main] }
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
jobs:
  build:
    runs-on: ubuntu-latest
    permissions: { contents: read }
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: '20.11', cache: 'pnpm' }
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm format
      - run: pnpm typecheck
      - run: pnpm test -- --coverage
      - uses: actions/upload-artifact@v4
        if: always()
        with: { name: coverage, path: coverage/ }
```

Python variant: replace Node setup with `actions/setup-python@v5` and run `pip install -e .[dev]`, `ruff check`, `ruff format --check`, `pyright`, `pytest --cov`.

Go variant: `actions/setup-go@v5` and run `go vet ./...`, `golangci-lint run`, `go test ./... -race -cover`.

Rust variant: `dtolnay/rust-toolchain@stable`, then `cargo fmt --check`, `cargo clippy -- -D warnings`, `cargo test --locked`.

### `Dockerfile` (Node multi-stage)

```dockerfile
# syntax=docker/dockerfile:1.7

FROM node:20.11-alpine AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,target=/root/.local/share/pnpm/store pnpm install --frozen-lockfile
COPY . .
RUN pnpm build && pnpm prune --prod

FROM gcr.io/distroless/nodejs20-debian12:nonroot AS runtime
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./package.json
USER nonroot
EXPOSE 3000
CMD ["dist/index.js"]
```

Python distroless variant: build with `python:3.11-slim`, copy installed site-packages into `gcr.io/distroless/python3-debian12:nonroot`.

Go scratch variant:

```dockerfile
FROM golang:1.23-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -trimpath -ldflags='-s -w' -o /out/app ./cmd/<name>

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /out/app /app
USER nonroot
EXPOSE 8080
ENTRYPOINT ["/app"]
```

Rust distroless variant: build with `rust:1.80-slim`, copy the binary into `gcr.io/distroless/cc-debian12:nonroot`.

### `LICENSE` (MIT template)

```
MIT License

Copyright (c) <year> <author>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

#!/usr/bin/env bash
#
# run-sca.sh — Software Composition Analysis orchestrator.
#
# Detects package manifests in REPO_PATH and runs the appropriate SCA tool
# for each ecosystem. Always runs osv-scanner as a universal baseline.
#
# Usage:
#   run-sca.sh [REPO_PATH] [OUT_DIR]
#
# Arguments:
#   REPO_PATH  Path to source tree (default: .)
#   OUT_DIR    Directory for artifacts (default: ./security-audit-out)
#
# Environment:
#   SCA_SEVERITY_FLOOR   Default: MEDIUM (passed to osv-scanner where applicable)
#   FAIL_ON_CRITICAL     Default: 1
#
# Exit codes:
#   0  no Critical CVEs
#   1  usage / missing tool
#   2  Critical CVE present
#   3  scanner crashed

set -euo pipefail

usage() {
    sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
    usage
    exit 0
fi

REPO_PATH="${1:-.}"
OUT_DIR="${2:-./security-audit-out}"
FAIL_ON_CRITICAL="${FAIL_ON_CRITICAL:-1}"

if [[ ! -d "$REPO_PATH" ]]; then
    echo "run-sca: REPO_PATH not found: $REPO_PATH" >&2
    exit 1
fi

mkdir -p "$OUT_DIR"
OUT_DIR="$(cd "$OUT_DIR" && pwd)"
REPO_PATH="$(cd "$REPO_PATH" && pwd)"

log() { printf '[run-sca %s] %s\n' "$(date -u +%H:%M:%SZ)" "$*" >&2; }
have() { command -v "$1" >/dev/null 2>&1; }

CRIT=0

# ---------------------------------------------------------------------------
# osv-scanner (universal)
# ---------------------------------------------------------------------------
OSV_OUT="$OUT_DIR/osv.json"
if have osv-scanner; then
    log "osv-scanner $REPO_PATH"
    set +e
    osv-scanner --format json --output "$OSV_OUT" -r "$REPO_PATH"
    OSV_RC=$?
    set -e
    if have jq && [[ -s "$OSV_OUT" ]]; then
        C=$(jq '[.results[].packages[]?.vulnerabilities[]? | select((.database_specific.severity // "") | ascii_upcase == "CRITICAL")] | length' "$OSV_OUT" 2>/dev/null || echo 0)
        CRIT=$((CRIT + C))
    fi
    log "osv-scanner rc=$OSV_RC -> $OSV_OUT (critical so far: $CRIT)"
else
    log "osv-scanner not installed — install from https://github.com/google/osv-scanner"
    echo '{"skipped":"osv-scanner not installed"}' > "$OSV_OUT"
fi

# ---------------------------------------------------------------------------
# npm / yarn / pnpm
# ---------------------------------------------------------------------------
if [[ -f "$REPO_PATH/package.json" ]]; then
    NPM_OUT="$OUT_DIR/npm-audit.json"
    if [[ -f "$REPO_PATH/pnpm-lock.yaml" ]] && have pnpm; then
        log "pnpm audit"
        set +e
        ( cd "$REPO_PATH" && pnpm audit --json ) > "$NPM_OUT"
        set -e
    elif [[ -f "$REPO_PATH/yarn.lock" ]] && have yarn; then
        log "yarn npm audit (berry) or yarn audit"
        set +e
        ( cd "$REPO_PATH" && yarn npm audit --json --all --recursive 2>/dev/null \
                          || yarn audit --json ) > "$NPM_OUT"
        set -e
    elif have npm; then
        log "npm audit"
        set +e
        ( cd "$REPO_PATH" && npm audit --json --omit=dev ) > "$NPM_OUT"
        set -e
    else
        log "no js package manager found — skipping js audit"
    fi
    if have jq && [[ -s "$NPM_OUT" ]]; then
        C=$(jq '.metadata.vulnerabilities.critical // 0' "$NPM_OUT" 2>/dev/null || echo 0)
        CRIT=$((CRIT + C))
        log "npm-audit critical: $C"
    fi
fi

# ---------------------------------------------------------------------------
# Python (pip / poetry)
# ---------------------------------------------------------------------------
if [[ -f "$REPO_PATH/requirements.txt" || -f "$REPO_PATH/pyproject.toml" || -f "$REPO_PATH/Pipfile.lock" ]]; then
    PIP_OUT="$OUT_DIR/pip-audit.json"
    if have pip-audit; then
        log "pip-audit"
        ARGS=(--format json --output "$PIP_OUT")
        if [[ -f "$REPO_PATH/requirements.txt" ]]; then
            ARGS+=(-r "$REPO_PATH/requirements.txt")
        elif [[ -f "$REPO_PATH/pyproject.toml" ]]; then
            # pip-audit reads local env by default; prefer a resolver.
            ARGS+=(--strict)
        fi
        set +e
        ( cd "$REPO_PATH" && pip-audit "${ARGS[@]}" )
        set -e
        if have jq && [[ -s "$PIP_OUT" ]]; then
            C=$(jq '[.dependencies[].vulns[]? | select((.fix_versions|length)==0)] | length' "$PIP_OUT" 2>/dev/null || echo 0)
            log "pip-audit vulns without fix: $C"
        fi
    else
        log "pip-audit not installed (pip install pip-audit)"
    fi
fi

# ---------------------------------------------------------------------------
# Go
# ---------------------------------------------------------------------------
if [[ -f "$REPO_PATH/go.mod" ]]; then
    GOVULN_OUT="$OUT_DIR/govulncheck.json"
    if have govulncheck; then
        log "govulncheck ./..."
        set +e
        ( cd "$REPO_PATH" && govulncheck -json ./... ) > "$GOVULN_OUT"
        set -e
        if have jq && [[ -s "$GOVULN_OUT" ]]; then
            C=$(jq -s '[.[] | select(.finding.osv != null)] | length' "$GOVULN_OUT" 2>/dev/null || echo 0)
            log "govulncheck findings: $C"
        fi
    else
        log "govulncheck not installed (go install golang.org/x/vuln/cmd/govulncheck@latest)"
    fi
fi

# ---------------------------------------------------------------------------
# Rust
# ---------------------------------------------------------------------------
if [[ -f "$REPO_PATH/Cargo.toml" ]]; then
    CARGO_OUT="$OUT_DIR/cargo-audit.json"
    if have cargo-audit; then
        log "cargo audit"
        set +e
        ( cd "$REPO_PATH" && cargo audit --json ) > "$CARGO_OUT"
        set -e
        if have jq && [[ -s "$CARGO_OUT" ]]; then
            C=$(jq '.vulnerabilities.count // 0' "$CARGO_OUT" 2>/dev/null || echo 0)
            log "cargo-audit vulns: $C"
        fi
    else
        log "cargo-audit not installed (cargo install cargo-audit)"
    fi
fi

# ---------------------------------------------------------------------------
# JVM (Maven / Gradle)
# ---------------------------------------------------------------------------
if [[ -f "$REPO_PATH/pom.xml" || -f "$REPO_PATH/build.gradle" || -f "$REPO_PATH/build.gradle.kts" ]]; then
    DC_OUT="$OUT_DIR/dependency-check.json"
    if have dependency-check; then
        log "dependency-check.sh (OWASP)"
        set +e
        dependency-check --project "$(basename "$REPO_PATH")" \
            --scan "$REPO_PATH" -f JSON -o "$OUT_DIR" --failOnCVSS 9
        set -e
    else
        log "OWASP dependency-check not installed — JVM SCA skipped"
    fi
fi

log "SCA done. Critical CVE count: $CRIT"

if (( FAIL_ON_CRITICAL == 1 && CRIT > 0 )); then
    exit 2
fi
exit 0

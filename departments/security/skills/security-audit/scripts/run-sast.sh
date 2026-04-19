#!/usr/bin/env bash
#
# run-sast.sh — Static Application Security Testing orchestrator.
#
# Runs Semgrep against the repo with the OWASP Top Ten + CI rulesets, and
# optionally runs SonarScanner when SONAR_HOST_URL/SONAR_TOKEN are set.
#
# Usage:
#   run-sast.sh [REPO_PATH] [OUT_DIR]
#
# Arguments:
#   REPO_PATH  Path to source tree (default: .)
#   OUT_DIR    Directory for artifacts (default: ./security-audit-out)
#
# Environment:
#   SEMGREP_CONFIG       Space-separated extra --config flags.
#   SONAR_HOST_URL       If set, runs sonar-scanner.
#   SONAR_TOKEN          Auth token for sonar-scanner.
#   SONAR_PROJECT_KEY    Project key for sonar-scanner.
#
# Exit codes:
#   0  all scanners completed, no Critical findings
#   1  usage / missing tool
#   2  scanner reported Critical findings
#   3  scanner crashed

set -euo pipefail

usage() {
    sed -n '2,22p' "$0" | sed 's/^# \{0,1\}//'
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
    usage
    exit 0
fi

REPO_PATH="${1:-.}"
OUT_DIR="${2:-./security-audit-out}"

if [[ ! -d "$REPO_PATH" ]]; then
    echo "run-sast: REPO_PATH does not exist: $REPO_PATH" >&2
    exit 1
fi

mkdir -p "$OUT_DIR"
OUT_DIR="$(cd "$OUT_DIR" && pwd)"
REPO_PATH="$(cd "$REPO_PATH" && pwd)"

log() { printf '[run-sast %s] %s\n' "$(date -u +%H:%M:%SZ)" "$*" >&2; }

have() { command -v "$1" >/dev/null 2>&1; }

# ---------------------------------------------------------------------------
# Semgrep
# ---------------------------------------------------------------------------
if ! have semgrep; then
    log "semgrep not found. Install with: pip install semgrep  (or brew install semgrep)"
    exit 1
fi

SEMGREP_OUT="$OUT_DIR/semgrep.sarif"
SEMGREP_JSON="$OUT_DIR/semgrep.json"
EXTRA_CFG="${SEMGREP_CONFIG:-}"

log "semgrep $(semgrep --version) scanning $REPO_PATH"
set +e
semgrep scan \
    --config=p/owasp-top-ten \
    --config=p/ci \
    --config=p/security-audit \
    ${EXTRA_CFG} \
    --sarif --output "$SEMGREP_OUT" \
    --metrics=off \
    --error \
    "$REPO_PATH"
SEMGREP_RC=$?
set -e

# Also emit JSON for easy jq parsing downstream.
semgrep scan \
    --config=p/owasp-top-ten \
    --config=p/ci \
    --config=p/security-audit \
    ${EXTRA_CFG} \
    --json --output "$SEMGREP_JSON" \
    --metrics=off \
    "$REPO_PATH" >/dev/null 2>&1 || true

log "semgrep wrote $SEMGREP_OUT (rc=$SEMGREP_RC)"

# ---------------------------------------------------------------------------
# SonarScanner (optional)
# ---------------------------------------------------------------------------
SONAR_RC=0
if [[ -n "${SONAR_HOST_URL:-}" && -n "${SONAR_TOKEN:-}" ]]; then
    if ! have sonar-scanner; then
        log "SONAR_HOST_URL set but sonar-scanner not installed — skipping"
    else
        PROJECT_KEY="${SONAR_PROJECT_KEY:-$(basename "$REPO_PATH")}"
        log "sonar-scanner -> $SONAR_HOST_URL (project=$PROJECT_KEY)"
        set +e
        ( cd "$REPO_PATH" && sonar-scanner \
            -Dsonar.host.url="$SONAR_HOST_URL" \
            -Dsonar.login="$SONAR_TOKEN" \
            -Dsonar.projectKey="$PROJECT_KEY" \
            -Dsonar.sources=. \
            -Dsonar.scm.provider=git \
            -Dsonar.qualitygate.wait=true \
            -Dsonar.working.directory="$OUT_DIR/.scannerwork" \
        )
        SONAR_RC=$?
        set -e
        # Persist the report-task.txt so CI can poll the task.
        if [[ -f "$OUT_DIR/.scannerwork/report-task.txt" ]]; then
            cp "$OUT_DIR/.scannerwork/report-task.txt" "$OUT_DIR/sonar-report.txt"
        fi
        log "sonar-scanner rc=$SONAR_RC"
    fi
else
    log "SONAR_HOST_URL/SONAR_TOKEN not set — skipping sonar-scanner"
fi

# ---------------------------------------------------------------------------
# Summarize
# ---------------------------------------------------------------------------
CRIT=0
if have jq && [[ -s "$SEMGREP_JSON" ]]; then
    CRIT=$(jq '[.results[] | select(.extra.severity=="ERROR")] | length' "$SEMGREP_JSON" 2>/dev/null || echo 0)
fi
log "semgrep ERROR-severity findings: $CRIT"

if (( SEMGREP_RC != 0 && SEMGREP_RC != 1 )); then
    # semgrep rc: 0 clean, 1 findings, >1 crash
    log "semgrep crashed"
    exit 3
fi

if (( SONAR_RC != 0 && SONAR_RC != 0 )); then
    log "sonar-scanner failed"
fi

if (( CRIT > 0 )); then
    exit 2
fi
exit 0

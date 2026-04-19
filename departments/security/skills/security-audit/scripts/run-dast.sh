#!/usr/bin/env bash
#
# run-dast.sh — Dynamic Application Security Testing orchestrator.
#
# Runs an OWASP ZAP baseline scan (via docker), a Nuclei scan for known-CVE /
# misconfig templates, and optionally Wapiti. Concatenates results into
# $OUT_DIR/dast-report.json.
#
# Usage:
#   run-dast.sh TARGET_URL [OUT_DIR]
#
# Arguments:
#   TARGET_URL  Base URL of the running app (required), e.g. https://staging.example.com
#   OUT_DIR     Directory for artifacts (default: ./security-audit-out)
#
# Environment:
#   ZAP_AUTH_HEADER      Sent to ZAP baseline as -z "replacer.full_list(...)" header.
#   ZAP_EXTRA_ARGS       Extra args for zap-baseline.py.
#   NUCLEI_SEVERITY      Default: critical,high,medium
#   NUCLEI_TEMPLATES     Custom templates path (default: default).
#   WAPITI_MODULES       Default: xss,sql,exec,file,crlf,redirect
#
# Exit codes:
#   0  all scanners completed, no Critical findings
#   1  usage / missing tool
#   2  scanner reported Critical/High findings
#   3  scanner crashed

set -euo pipefail

usage() {
    sed -n '2,25p' "$0" | sed 's/^# \{0,1\}//'
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" || -z "${1:-}" ]]; then
    usage
    [[ -z "${1:-}" ]] && exit 1 || exit 0
fi

TARGET_URL="$1"
OUT_DIR="${2:-./security-audit-out}"

if [[ ! "$TARGET_URL" =~ ^https?:// ]]; then
    echo "run-dast: TARGET_URL must start with http:// or https://" >&2
    exit 1
fi

mkdir -p "$OUT_DIR"
OUT_DIR="$(cd "$OUT_DIR" && pwd)"

log() { printf '[run-dast %s] %s\n' "$(date -u +%H:%M:%SZ)" "$*" >&2; }
have() { command -v "$1" >/dev/null 2>&1; }

# Production safety nudge.
if [[ "$TARGET_URL" =~ (prod|production|\.com/?$) ]] && [[ -z "${DAST_ALLOW_PROD:-}" ]]; then
    log "Refusing to scan production-looking URL without DAST_ALLOW_PROD=1: $TARGET_URL"
    exit 1
fi

ZAP_OUT="$OUT_DIR/zap-baseline.json"
ZAP_HTML="$OUT_DIR/zap-baseline.html"
NUCLEI_OUT="$OUT_DIR/nuclei.json"
WAPITI_OUT="$OUT_DIR/wapiti.json"
COMBINED="$OUT_DIR/dast-report.json"

CRIT=0

# ---------------------------------------------------------------------------
# ZAP baseline
# ---------------------------------------------------------------------------
if have docker; then
    log "ZAP baseline -> $TARGET_URL"
    ZAP_CMD=(docker run --rm -v "$OUT_DIR":/zap/wrk/:rw -t owasp/zap2docker-stable
             zap-baseline.py -t "$TARGET_URL"
             -J "$(basename "$ZAP_OUT")"
             -r "$(basename "$ZAP_HTML")"
             -I)
    if [[ -n "${ZAP_AUTH_HEADER:-}" ]]; then
        ZAP_CMD+=(-z "replacer.full_list(0).description=auth \
replacer.full_list(0).enabled=true \
replacer.full_list(0).matchtype=REQ_HEADER \
replacer.full_list(0).matchstr=Authorization \
replacer.full_list(0).regex=false \
replacer.full_list(0).replacement=$ZAP_AUTH_HEADER")
    fi
    if [[ -n "${ZAP_EXTRA_ARGS:-}" ]]; then
        # shellcheck disable=SC2206
        ZAP_CMD+=($ZAP_EXTRA_ARGS)
    fi
    set +e
    "${ZAP_CMD[@]}"
    ZAP_RC=$?
    set -e
    log "zap rc=$ZAP_RC -> $ZAP_OUT"
else
    log "docker not found — skipping ZAP baseline"
    echo '{"skipped":"docker not installed"}' > "$ZAP_OUT"
fi

# ---------------------------------------------------------------------------
# Nuclei
# ---------------------------------------------------------------------------
if have nuclei; then
    SEV="${NUCLEI_SEVERITY:-critical,high,medium}"
    log "nuclei severity=$SEV"
    NUCLEI_CMD=(nuclei -u "$TARGET_URL" -severity "$SEV" -jsonl -o "$NUCLEI_OUT" -silent -disable-update-check)
    if [[ -n "${NUCLEI_TEMPLATES:-}" ]]; then
        NUCLEI_CMD+=(-t "$NUCLEI_TEMPLATES")
    fi
    set +e
    "${NUCLEI_CMD[@]}"
    NUCLEI_RC=$?
    set -e
    if have jq && [[ -s "$NUCLEI_OUT" ]]; then
        # Convert jsonl to json array for downstream consumers.
        jq -s '.' "$NUCLEI_OUT" > "$NUCLEI_OUT.arr" && mv "$NUCLEI_OUT.arr" "$NUCLEI_OUT"
        C=$(jq '[.[] | select(.info.severity=="critical" or .info.severity=="high")] | length' "$NUCLEI_OUT")
        CRIT=$((CRIT + C))
    fi
    log "nuclei rc=$NUCLEI_RC -> $NUCLEI_OUT"
else
    log "nuclei not installed — skipping (https://github.com/projectdiscovery/nuclei)"
    echo '[]' > "$NUCLEI_OUT"
fi

# ---------------------------------------------------------------------------
# Wapiti (optional)
# ---------------------------------------------------------------------------
if have wapiti; then
    MODS="${WAPITI_MODULES:-xss,sql,exec,file,crlf,redirect}"
    log "wapiti modules=$MODS"
    set +e
    wapiti -u "$TARGET_URL" -m "$MODS" -f json -o "$WAPITI_OUT" --flush-session --verify-ssl 1
    WAPITI_RC=$?
    set -e
    log "wapiti rc=$WAPITI_RC -> $WAPITI_OUT"
else
    log "wapiti not installed — skipping"
    echo '{"skipped":"wapiti not installed"}' > "$WAPITI_OUT"
fi

# ---------------------------------------------------------------------------
# Combine
# ---------------------------------------------------------------------------
if have jq; then
    jq -n \
        --slurpfile zap     "$ZAP_OUT" \
        --slurpfile nuclei  "$NUCLEI_OUT" \
        --slurpfile wapiti  "$WAPITI_OUT" \
        --arg target "$TARGET_URL" \
        --arg ts "$(date -u +%FT%TZ)" \
        '{target:$target, timestamp:$ts, zap:($zap[0]//null), nuclei:($nuclei[0]//[]), wapiti:($wapiti[0]//null)}' \
        > "$COMBINED"
    log "combined -> $COMBINED"
fi

if (( CRIT > 0 )); then
    log "DAST found $CRIT critical/high findings"
    exit 2
fi
exit 0

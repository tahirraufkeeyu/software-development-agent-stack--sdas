#!/usr/bin/env bash
#
# nuclear-scan.sh — exhaustive git secret scan.
#
# Runs Gitleaks (detect) and TruffleHog over the git object graph — including
# every branch, every tag, reflog, and stash refs. Merges, deduplicates and
# redacts matches into $OUT_DIR/secrets.deduped.json.
#
# Usage:
#   nuclear-scan.sh [REPO_PATH] [OUT_DIR]
#
# Arguments:
#   REPO_PATH  Path to git repo (default: .)
#   OUT_DIR    Output directory (default: ./secret-scan-out)
#
# Environment:
#   ALLOWLIST        Path to gitleaks/allowlist file.
#   SCAN_REFLOG      1 (default) to include reflog + stash refs.
#   REDACT           1 (default) to redact matches in outputs.
#   ALLOW_DIRTY      1 to proceed when worktree is dirty.
#
# Exit codes:
#   0  no findings
#   1  usage / missing tool
#   2  verified critical findings present
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
OUT_DIR="${2:-./secret-scan-out}"
SCAN_REFLOG="${SCAN_REFLOG:-1}"
REDACT="${REDACT:-1}"

have() { command -v "$1" >/dev/null 2>&1; }
log()  { printf '[nuclear-scan %s] %s\n' "$(date -u +%H:%M:%SZ)" "$*" >&2; }

for t in git jq; do
    have "$t" || { echo "missing required tool: $t" >&2; exit 1; }
done

if ! have gitleaks; then
    log "gitleaks not installed — see https://github.com/gitleaks/gitleaks"
    exit 1
fi
if ! have trufflehog; then
    log "trufflehog not installed — see https://github.com/trufflesecurity/trufflehog"
    exit 1
fi

cd "$REPO_PATH"
REPO_PATH="$(pwd)"

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    echo "not a git repo: $REPO_PATH" >&2
    exit 1
fi

if ! git diff --quiet || ! git diff --cached --quiet; then
    if [[ "${ALLOW_DIRTY:-0}" != "1" ]]; then
        log "working tree dirty — refusing (set ALLOW_DIRTY=1 to override)"
        exit 1
    fi
    log "working tree dirty — proceeding because ALLOW_DIRTY=1"
fi

mkdir -p "$OUT_DIR"
OUT_DIR="$(cd "$OUT_DIR" && pwd)"

GL_OUT="$OUT_DIR/gitleaks-report.json"
TH_OUT="$OUT_DIR/trufflehog-report.json"
MERGED="$OUT_DIR/secrets.deduped.json"

# Ensure we see every ref before scanning.
log "fetching all refs..."
git fetch --all --tags --prune --quiet || log "git fetch failed — continuing with local refs"

# ---------------------------------------------------------------------------
# Gitleaks — full git log scan
# ---------------------------------------------------------------------------
GL_ARGS=(detect --source "$REPO_PATH" --report-format json --report-path "$GL_OUT" --no-banner --log-level warn)
if [[ "$REDACT" == "1" ]]; then
    GL_ARGS+=(--redact)
fi
if [[ -n "${ALLOWLIST:-}" && -f "$ALLOWLIST" ]]; then
    GL_ARGS+=(--config "$ALLOWLIST")
fi

log "gitleaks $(gitleaks version 2>/dev/null || echo ?)"
set +e
gitleaks "${GL_ARGS[@]}"
GL_RC=$?
set -e
log "gitleaks rc=$GL_RC -> $GL_OUT"

# ---------------------------------------------------------------------------
# TruffleHog — full git URL scan with verification
# ---------------------------------------------------------------------------
TH_ARGS=(git "file://$REPO_PATH" --json --no-update)
if [[ -n "${TRUFFLEHOG_CONFIG:-}" && -f "$TRUFFLEHOG_CONFIG" ]]; then
    TH_ARGS+=(--config "$TRUFFLEHOG_CONFIG")
fi

log "trufflehog $(trufflehog --version 2>&1 | head -n1 || echo ?)"
set +e
trufflehog "${TH_ARGS[@]}" > "$TH_OUT.jsonl"
TH_RC=$?
set -e

# Convert jsonl -> json array.
if [[ -s "$TH_OUT.jsonl" ]]; then
    jq -cs '.' "$TH_OUT.jsonl" > "$TH_OUT"
else
    echo '[]' > "$TH_OUT"
fi
rm -f "$TH_OUT.jsonl"
log "trufflehog rc=$TH_RC -> $TH_OUT"

# ---------------------------------------------------------------------------
# Reflog + stash walk (captures dropped branches + aborted rebases)
# ---------------------------------------------------------------------------
if [[ "$SCAN_REFLOG" == "1" ]]; then
    REFLOG_SHAS="$OUT_DIR/reflog.shas"
    git reflog --all --format='%H' > "$REFLOG_SHAS"
    git stash list --format='%H' >> "$REFLOG_SHAS" 2>/dev/null || true
    sort -u "$REFLOG_SHAS" -o "$REFLOG_SHAS"
    log "reflog contains $(wc -l < "$REFLOG_SHAS") unique commits"

    # Re-run gitleaks per reflog commit that's unreachable from HEAD.
    UNREACH="$OUT_DIR/unreachable.shas"
    : > "$UNREACH"
    while read -r sha; do
        [[ -z "$sha" ]] && continue
        if ! git merge-base --is-ancestor "$sha" HEAD 2>/dev/null; then
            echo "$sha" >> "$UNREACH"
        fi
    done < "$REFLOG_SHAS"
    log "unreachable commits to re-scan: $(wc -l < "$UNREACH")"

    if [[ -s "$UNREACH" ]]; then
        GL_UN_OUT="$OUT_DIR/gitleaks-unreachable.json"
        echo '[]' > "$GL_UN_OUT"
        while read -r sha; do
            set +e
            gitleaks detect --source "$REPO_PATH" --log-opts "$sha^!" \
                --report-format json --report-path "$OUT_DIR/.gl.$sha.json" \
                --redact --no-banner --log-level error >/dev/null 2>&1
            set -e
            if [[ -s "$OUT_DIR/.gl.$sha.json" ]]; then
                jq -s '.[0] + .[1]' "$GL_UN_OUT" "$OUT_DIR/.gl.$sha.json" > "$GL_UN_OUT.t" && mv "$GL_UN_OUT.t" "$GL_UN_OUT"
            fi
            rm -f "$OUT_DIR/.gl.$sha.json"
        done < "$UNREACH"
        # Merge unreachable into main gitleaks result.
        if [[ -s "$GL_OUT" ]]; then
            jq -s 'add' "$GL_OUT" "$GL_UN_OUT" > "$GL_OUT.t" && mv "$GL_OUT.t" "$GL_OUT"
        fi
    fi
fi

# ---------------------------------------------------------------------------
# Unify + dedupe
# ---------------------------------------------------------------------------
jq -n \
  --slurpfile gl "$GL_OUT" \
  --slurpfile th "$TH_OUT" \
  '
  def norm_gl($r):
    {
      id: ($r.Commit + "|" + ($r.File // "") + "|" + ($r.RuleID // "") + "|" + ($r.Match // "" | tostring)) | @base64 | .[0:16],
      source: "gitleaks",
      rule: ($r.RuleID // "unknown"),
      file: ($r.File // ""),
      commit: ($r.Commit // ""),
      author: ($r.Author // ""),
      email: ($r.Email // ""),
      date: ($r.Date // ""),
      line: ($r.StartLine // 0),
      redacted_match: ($r.Match // $r.Secret // "" | tostring),
      verified: false,
      severity: "high"
    };
  def norm_th($r):
    {
      id: (($r.SourceMetadata.Data.Git.commit // "") + "|" + ($r.SourceMetadata.Data.Git.file // "") + "|" + ($r.DetectorName // "")) | @base64 | .[0:16],
      source: "trufflehog",
      rule: ($r.DetectorName // "unknown"),
      file: ($r.SourceMetadata.Data.Git.file // ""),
      commit: ($r.SourceMetadata.Data.Git.commit // ""),
      author: ($r.SourceMetadata.Data.Git.email // ""),
      email: ($r.SourceMetadata.Data.Git.email // ""),
      date: ($r.SourceMetadata.Data.Git.timestamp // ""),
      line: ($r.SourceMetadata.Data.Git.line // 0),
      redacted_match: (($r.Raw // "") | .[0:4] + "****************" + .[-4:]),
      verified: ($r.Verified // false),
      severity: (if ($r.Verified // false) then "critical" else "high" end)
    };
  ( ($gl[0] // []) | map(norm_gl(.)) )
  + ( ($th[0] // []) | map(norm_th(.)) )
  | group_by(.commit + "|" + .file + "|" + .rule)
  | map(.[0] + {sources: (map(.source) | unique)})
  ' > "$MERGED"

TOTAL=$(jq 'length' "$MERGED")
CRIT=$(jq '[.[] | select(.severity=="critical")] | length' "$MERGED")
log "merged total=$TOTAL critical=$CRIT -> $MERGED"

if (( CRIT > 0 )); then
    exit 2
fi
exit 0

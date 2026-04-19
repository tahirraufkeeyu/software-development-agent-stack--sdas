#!/usr/bin/env bash
# install.sh — install skills from this starter kit into ~/.claude/skills
#
# Usage:
#   ./install.sh <department>       # install one department (e.g. developers)
#   ./install.sh all                # install every department
#   ./install.sh --list             # list available departments
#   ./install.sh --dry-run <dept>   # show what would be copied without doing it
#   ./install.sh --update           # pull latest repo version + re-sync installed skills
#
# Exit codes:
#   0  success
#   1  invalid usage or unknown department
#   2  target directory conflict the user declined to resolve

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPT_ROOT="${REPO_ROOT}/departments"
TARGET_DIR="${CLAUDE_SKILLS_DIR:-${HOME}/.claude/skills}"

# --- helpers ----------------------------------------------------------------

color() {
    # $1 = color name, $2... = message
    local c="$1"; shift
    case "$c" in
        red)    printf "\033[31m%s\033[0m\n" "$*" ;;
        green)  printf "\033[32m%s\033[0m\n" "$*" ;;
        yellow) printf "\033[33m%s\033[0m\n" "$*" ;;
        blue)   printf "\033[34m%s\033[0m\n" "$*" ;;
        bold)   printf "\033[1m%s\033[0m\n" "$*" ;;
        *)      printf "%s\n" "$*" ;;
    esac
}

list_departments() {
    find "${DEPT_ROOT}" -mindepth 1 -maxdepth 1 -type d -exec basename {} \; | sort
}

confirm() {
    # $1 = prompt. Returns 0 if user answers y/Y.
    local reply
    read -r -p "$1 [y/N] " reply
    [[ "${reply}" =~ ^[Yy]$ ]]
}

usage() {
    sed -n '2,12p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
    echo
    echo "Available departments:"
    list_departments | sed 's/^/  - /'
}

# --- install ----------------------------------------------------------------

install_department() {
    local dept="$1"
    local dry_run="${2:-0}"
    local src="${DEPT_ROOT}/${dept}/skills"

    if [[ ! -d "${src}" ]]; then
        color red "  ✗ department '${dept}' not found at ${src}"
        return 1
    fi

    mkdir -p "${TARGET_DIR}"

    local installed=0
    local skipped=0

    while IFS= read -r -d '' skill_dir; do
        local skill_name
        skill_name="$(basename "${skill_dir}")"
        local dest="${TARGET_DIR}/${skill_name}"

        if [[ -d "${dest}" ]]; then
            if ! confirm "    skill '${skill_name}' already exists at ${dest}. Overwrite?"; then
                color yellow "    ↷ skipped ${skill_name}"
                skipped=$((skipped + 1))
                continue
            fi
            [[ "${dry_run}" == "1" ]] || rm -rf "${dest}"
        fi

        if [[ "${dry_run}" == "1" ]]; then
            color blue "    [dry-run] would copy ${skill_name}"
        else
            cp -R "${skill_dir}" "${dest}"
            color green "    ✓ installed ${skill_name}"
        fi
        installed=$((installed + 1))
    done < <(find "${src}" -mindepth 1 -maxdepth 1 -type d -print0)

    color bold "  ${dept}: ${installed} installed, ${skipped} skipped"
}

# --- update -----------------------------------------------------------------
# Pull the latest repo contents (if possible) and re-sync every skill already
# present in TARGET_DIR. No prompts — "update" implies "I want the latest".

update_installed() {
    local dry_run="${1:-0}"

    # Attempt a git pull if this is a clean git checkout on a tracking branch.
    if [[ -d "${REPO_ROOT}/.git" ]]; then
        if ! git -C "${REPO_ROOT}" diff-index --quiet HEAD -- 2>/dev/null; then
            color yellow "  ! repo has uncommitted changes — skipping git pull"
        elif ! git -C "${REPO_ROOT}" rev-parse --abbrev-ref '@{u}' >/dev/null 2>&1; then
            color yellow "  ! no upstream branch configured — skipping git pull"
        else
            color blue "  → pulling latest from origin…"
            if git -C "${REPO_ROOT}" pull --ff-only --quiet 2>/dev/null; then
                color green "  ✓ repo up to date"
            else
                color yellow "  ! git pull failed (offline, auth, or non-ff) — continuing with local version"
            fi
        fi
    else
        color yellow "  ! not a git checkout — skipping pull"
    fi

    if [[ ! -d "${TARGET_DIR}" ]]; then
        color yellow "  nothing installed at ${TARGET_DIR}"
        return 0
    fi

    local updated=0
    local missing=0

    while IFS= read -r -d '' installed_dir; do
        local skill_name
        skill_name="$(basename "${installed_dir}")"

        # Find this skill in departments/*/skills/<name>/
        local source_dir=""
        while IFS= read -r -d '' candidate; do
            source_dir="${candidate}"
            break
        done < <(find "${DEPT_ROOT}" -mindepth 3 -maxdepth 3 -type d -name "${skill_name}" -print0 2>/dev/null)

        if [[ -z "${source_dir}" ]]; then
            color yellow "  ? ${skill_name} installed but not shipped by this repo — leaving untouched"
            missing=$((missing + 1))
            continue
        fi

        if [[ "${dry_run}" == "1" ]]; then
            color blue "  [dry-run] would update ${skill_name}"
        else
            rm -rf "${installed_dir}"
            cp -R "${source_dir}" "${installed_dir}"
            color green "  ✓ updated ${skill_name}"
        fi
        updated=$((updated + 1))
    done < <(find "${TARGET_DIR}" -mindepth 1 -maxdepth 1 -type d -print0)

    color bold ""
    color bold "  ${updated} skills re-synced, ${missing} left untouched (not part of this kit)"
}

# --- main -------------------------------------------------------------------

main() {
    if [[ $# -eq 0 ]]; then
        usage
        exit 1
    fi

    local dry_run=0
    if [[ "$1" == "--dry-run" ]]; then
        dry_run=1
        shift
    fi

    case "${1:-}" in
        ""|--help|-h)
            usage
            ;;
        --list)
            list_departments
            ;;
        --update)
            color bold "Updating skills in ${TARGET_DIR}"
            update_installed "${dry_run}"
            color green "Done."
            ;;
        all)
            color bold "Installing all departments into ${TARGET_DIR}"
            while IFS= read -r dept; do
                color bold ""
                color bold "▸ ${dept}"
                install_department "${dept}" "${dry_run}"
            done < <(list_departments)
            color bold ""
            color green "Done. Skills installed at ${TARGET_DIR}"
            ;;
        *)
            if ! list_departments | grep -qx "$1"; then
                color red "Unknown department: $1"
                color yellow "Run './install.sh --list' to see available departments."
                exit 1
            fi
            color bold "Installing '${1}' into ${TARGET_DIR}"
            install_department "$1" "${dry_run}"
            color green "Done."
            ;;
    esac
}

main "$@"

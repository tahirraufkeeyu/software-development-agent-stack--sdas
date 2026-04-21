#!/usr/bin/env sh
#
# install-remote.sh — curl | sh installer for skillskit.
#
# Serves users who don't use Homebrew or Scoop, or who want to install
# on a machine where a package manager isn't available (CI runners,
# containers, remote servers).
#
# Usage:
#
#   curl -fsSL https://skillskit.dev/install | sh
#
# Behaviour:
#
#   1. Detects the host OS and architecture.
#   2. Downloads the matching archive from the latest GitHub Release.
#   3. Verifies the SHA256 checksum against the release's checksums.txt.
#   4. Extracts the `skillskit` binary into $INSTALL_DIR (default:
#      /usr/local/bin if writable, else ~/.local/bin).
#   5. Prints post-install instructions for running it and for adding
#      ~/.local/bin to PATH if needed.
#
# Optional env vars:
#
#   SKILLSKIT_VERSION    Install a specific version (e.g. "v0.1.0")
#                        instead of the latest release.
#   INSTALL_DIR          Override the install directory. Must exist
#                        and be writable by the current user.
#   SKIP_VERIFY          Set to "1" to skip checksum verification
#                        (NOT recommended; only for debugging).
#
# Exit codes:
#
#   0  success
#   1  generic failure (network, extract, write)
#   2  unsupported OS / arch
#   3  checksum mismatch
#
# POSIX sh, no bash-isms — so the same script works on busybox / ash.

set -eu

REPO="tahirraufkeeyu/software-development-agent-stack--sdas"
BINARY="skillskit"

# ----- helpers ---------------------------------------------------------

err() {
  printf "error: %s\n" "$*" >&2
  exit 1
}

info() {
  printf "==> %s\n" "$*"
}

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || err "required command not found: $1"
}

# ----- host detection --------------------------------------------------

detect_os() {
  os=$(uname -s | tr '[:upper:]' '[:lower:]')
  case "$os" in
    linux)  printf "linux"  ;;
    darwin) printf "macOS"  ;;
    *)      printf "%s" "$os" ;;
  esac
}

detect_arch() {
  arch=$(uname -m)
  case "$arch" in
    x86_64 | amd64)          printf "x86_64" ;;
    arm64 | aarch64)         printf "arm64"  ;;
    *)                       printf "%s" "$arch" ;;
  esac
}

# ----- prereqs ---------------------------------------------------------

need_cmd uname
need_cmd mktemp
need_cmd tar

if command -v curl >/dev/null 2>&1; then
  DOWNLOADER="curl -fsSL"
elif command -v wget >/dev/null 2>&1; then
  DOWNLOADER="wget -q -O -"
else
  err "curl or wget is required"
fi

# sha256 tool varies by OS.
if command -v sha256sum >/dev/null 2>&1; then
  SHA_CMD="sha256sum"
elif command -v shasum >/dev/null 2>&1; then
  SHA_CMD="shasum -a 256"
else
  SHA_CMD=""
fi

# ----- version resolution ---------------------------------------------

VERSION="${SKILLSKIT_VERSION:-}"
if [ -z "$VERSION" ]; then
  info "resolving latest skillskit release..."
  # GitHub's /releases/latest redirects to /tag/vX.Y.Z; we parse the
  # Location header. Avoids the JSON API + a jq dependency.
  LATEST_URL=$($DOWNLOADER -I "https://github.com/$REPO/releases/latest" 2>/dev/null \
    | awk -v IGNORECASE=1 '/^location:/ {print $2}' \
    | tr -d '\r' \
    | tail -n1 || true)
  VERSION=$(printf "%s" "$LATEST_URL" | awk -F/ '{print $NF}')
  [ -n "$VERSION" ] || err "could not resolve latest release; set SKILLSKIT_VERSION manually"
fi
info "installing skillskit $VERSION"

# Strip leading v for archive name interpolation.
VERSION_NUMBER=$(printf "%s" "$VERSION" | sed 's/^v//')

OS=$(detect_os)
ARCH=$(detect_arch)

case "$OS/$ARCH" in
  linux/x86_64 | linux/arm64 | macOS/x86_64 | macOS/arm64) ;;
  *)
    printf "unsupported OS/arch combo: %s/%s\n" "$OS" "$ARCH" >&2
    printf "Supported: linux/x86_64, linux/arm64, macOS/x86_64, macOS/arm64.\n" >&2
    printf "On Windows, use the PowerShell installer instead:\n" >&2
    printf "  iwr https://skillskit.dev/install.ps1 -useb | iex\n" >&2
    exit 2
    ;;
esac

ARCHIVE="skillskit_${VERSION_NUMBER}_${OS}_${ARCH}.tar.gz"
URL="https://github.com/$REPO/releases/download/$VERSION/$ARCHIVE"
CHECKSUM_URL="https://github.com/$REPO/releases/download/$VERSION/checksums.txt"

# ----- download --------------------------------------------------------

TMP_DIR=$(mktemp -d 2>/dev/null || mktemp -d -t 'skillskit')
trap 'rm -rf "$TMP_DIR"' EXIT

info "downloading $ARCHIVE"
$DOWNLOADER "$URL" > "$TMP_DIR/$ARCHIVE" || err "failed to download $URL"

# ----- verify checksum -------------------------------------------------

if [ "${SKIP_VERIFY:-0}" != "1" ] && [ -n "$SHA_CMD" ]; then
  info "verifying checksum"
  $DOWNLOADER "$CHECKSUM_URL" > "$TMP_DIR/checksums.txt" \
    || err "failed to download checksums.txt from release"
  EXPECTED=$(awk -v name="$ARCHIVE" '$2 == name {print $1}' "$TMP_DIR/checksums.txt")
  if [ -z "$EXPECTED" ]; then
    err "archive not found in checksums.txt (malformed release?)"
  fi
  ACTUAL=$(cd "$TMP_DIR" && $SHA_CMD "$ARCHIVE" | awk '{print $1}')
  if [ "$ACTUAL" != "$EXPECTED" ]; then
    printf "checksum mismatch!\n  expected: %s\n  got:      %s\n" "$EXPECTED" "$ACTUAL" >&2
    exit 3
  fi
elif [ "${SKIP_VERIFY:-0}" = "1" ]; then
  info "skipping checksum verification (SKIP_VERIFY=1)"
else
  info "no sha256 tool found; skipping checksum verification"
fi

# ----- extract ---------------------------------------------------------

info "extracting"
tar -xzf "$TMP_DIR/$ARCHIVE" -C "$TMP_DIR"
if [ ! -f "$TMP_DIR/$BINARY" ]; then
  err "binary $BINARY not found in archive"
fi
chmod +x "$TMP_DIR/$BINARY"

# ----- install to PATH -------------------------------------------------

# Prefer /usr/local/bin if writable (system-wide). Fall back to
# ~/.local/bin for per-user installs — doesn't need sudo.
if [ -z "${INSTALL_DIR:-}" ]; then
  if [ -w /usr/local/bin ]; then
    INSTALL_DIR=/usr/local/bin
  elif [ -d "$HOME/.local/bin" ] || mkdir -p "$HOME/.local/bin" 2>/dev/null; then
    INSTALL_DIR="$HOME/.local/bin"
  else
    err "no writable install dir found; set INSTALL_DIR=/path to override"
  fi
fi

install -m 0755 "$TMP_DIR/$BINARY" "$INSTALL_DIR/$BINARY" \
  || err "failed to install to $INSTALL_DIR (try INSTALL_DIR=\$HOME/.local/bin)"

info "installed $BINARY $VERSION to $INSTALL_DIR"

# ----- post-install ---------------------------------------------------

case ":$PATH:" in
  *":$INSTALL_DIR:"*) ;;
  *)
    printf "\n"
    printf "%s is not on your PATH. Add this to ~/.zshrc or ~/.bashrc:\n" "$INSTALL_DIR"
    printf "\n  export PATH=\"%s:\$PATH\"\n\n" "$INSTALL_DIR"
    ;;
esac

printf "\n"
printf "Next: skillskit install all\n"
printf "      skillskit --help\n"

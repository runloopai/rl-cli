#!/bin/bash
#
# Install rl-cli (rli) from the latest GitHub release.
# Usage: curl -fsSL https://raw.githubusercontent.com/runloopai/rl-cli/main/install_standalone.sh | bash
#        Or with a specific version: curl ... | bash -s -- v1.10.0
#
set -e

REPO="runloopai/rl-cli"
GITHUB_API="https://api.github.com/repos/${REPO}"
RELEASES_URL="https://github.com/${REPO}/releases"
INSTALL_DIR="${RLI_INSTALL_DIR:-$HOME/.local/bin}"
TARGET="${1:-latest}"

# Validate target if provided
if [[ -n "$TARGET" ]] && [[ "$TARGET" != "latest" ]] && [[ ! "$TARGET" =~ ^v[0-9]+\.[0-9]+\.[0-9]+(-[^[:space:]]+)?$ ]]; then
  echo "Usage: $0 [latest|vVERSION]" >&2
  echo "  e.g. $0 latest   # install latest release" >&2
  echo "       $0 v1.10.0  # install specific version" >&2
  exit 1
fi

# Check for required dependencies
DOWNLOADER=""
if command -v curl >/dev/null 2>&1; then
  DOWNLOADER="curl"
elif command -v wget >/dev/null 2>&1; then
  DOWNLOADER="wget"
else
  echo "Either curl or wget is required but neither is installed" >&2
  exit 1
fi

download_file() {
  local url="$1"
  local output="$2"

  if [[ "$DOWNLOADER" == "curl" ]]; then
    if [[ -n "$output" ]]; then
      curl -fsSL -o "$output" "$url"
    else
      curl -fsSL "$url"
    fi
  else
    if [[ -n "$output" ]]; then
      wget -q -O "$output" "$url"
    else
      wget -q -O - "$url"
    fi
  fi
}

# Resolve version and download base URL
if [[ "$TARGET" == "latest" ]]; then
  # Get latest release tag from GitHub API (works without auth for public repos)
  if [[ "$DOWNLOADER" == "curl" ]]; then
    VERSION=$(curl -fsSL "${GITHUB_API}/releases/latest" | grep '"tag_name":' | sed -E 's/.*"tag_name":\s*"([^"]+)".*/\1/')
  else
    VERSION=$(wget -qO - "${GITHUB_API}/releases/latest" | grep '"tag_name":' | sed -E 's/.*"tag_name":\s*"([^"]+)".*/\1/')
  fi
  if [[ -z "$VERSION" ]]; then
    echo "Failed to determine latest release version" >&2
    exit 1
  fi
else
  VERSION="$TARGET"
fi

DOWNLOAD_BASE="${RELEASES_URL}/download/${VERSION}"

# Detect platform
case "$(uname -s)" in
  Darwin) os="darwin" ;;
  Linux)  os="linux" ;;
  *)
    echo "Unsupported OS: $(uname -s). Only macOS and Linux are supported by this script." >&2
    echo "See ${RELEASES_URL} for Windows executables." >&2
    exit 1
    ;;
esac

case "$(uname -m)" in
  x86_64|amd64) arch="x64" ;;
  arm64|aarch64) arch="arm64" ;;
  *)
    echo "Unsupported architecture: $(uname -m)" >&2
    exit 1
    ;;
esac

# On macOS, prefer arm64 when running under Rosetta on Apple Silicon
if [[ "$os" == "darwin" ]] && [[ "$arch" == "x64" ]]; then
  if [[ "$(sysctl -n sysctl.proc_translated 2>/dev/null)" == "1" ]]; then
    arch="arm64"
  fi
fi

# Asset name (no .exe on Unix)
if [[ "$os" == "darwin" ]]; then
  ASSET="rli-macos-${arch}"
else
  ASSET="rli-linux-${arch}"
fi

mkdir -p "$INSTALL_DIR"
BINARY_PATH="${INSTALL_DIR}/rli"
TMP_BINARY="${INSTALL_DIR}/rli.tmp.$$"

# Download checksums and binary
echo "Installing rli ${VERSION} (${ASSET})..."
if ! download_file "${DOWNLOAD_BASE}/checksums.txt" "${TMP_BINARY}.checksums"; then
  echo "This release may not include pre-built executables. Try:" >&2
  echo "  npm install -g @runloop/rl-cli" >&2
  rm -f "${TMP_BINARY}.checksums"
  exit 1
fi

EXPECTED_CHECKSUM=$(grep -E "^\s*[a-f0-9]{64}\s+${ASSET}\s*$" "${TMP_BINARY}.checksums" | awk '{print $1}')
if [[ -z "$EXPECTED_CHECKSUM" ]]; then
  # Try without leading whitespace
  EXPECTED_CHECKSUM=$(grep "$ASSET" "${TMP_BINARY}.checksums" | awk '{print $1}')
fi
rm -f "${TMP_BINARY}.checksums"

if [[ -z "$EXPECTED_CHECKSUM" ]]; then
  echo "Checksum for ${ASSET} not found in release" >&2
  exit 1
fi

if ! download_file "${DOWNLOAD_BASE}/${ASSET}" "$TMP_BINARY"; then
  echo "Download failed for ${ASSET}" >&2
  rm -f "$TMP_BINARY"
  exit 1
fi

# Verify checksum
if command -v shasum >/dev/null 2>&1; then
  ACTUAL=$(shasum -a 256 "$TMP_BINARY" | cut -d' ' -f1)
elif command -v sha256sum >/dev/null 2>&1; then
  ACTUAL=$(sha256sum "$TMP_BINARY" | cut -d' ' -f1)
else
  echo "Neither shasum nor sha256sum found; skipping checksum verification" >&2
  ACTUAL="$EXPECTED_CHECKSUM"
fi

if [[ "$ACTUAL" != "$EXPECTED_CHECKSUM" ]]; then
  echo "Checksum verification failed (expected ${EXPECTED_CHECKSUM:0:16}..., got ${ACTUAL:0:16}...)" >&2
  rm -f "$TMP_BINARY"
  exit 1
fi

chmod +x "$TMP_BINARY"
mv -f "$TMP_BINARY" "$BINARY_PATH"

echo ""
echo "✅ rli ${VERSION} installed to ${BINARY_PATH}"
echo ""
if [[ ":$PATH:" != *":${INSTALL_DIR}:"* ]]; then
  echo "Add ${INSTALL_DIR} to your PATH to run \`rli\` from the shell:"
  echo "  export PATH=\"${INSTALL_DIR}:\$PATH\""
  echo ""
  echo "To make this permanent, add the line above to your shell profile (~/.bashrc, ~/.zshrc, etc.)."
  echo ""
fi
echo "Run \`rli --help\` to get started."

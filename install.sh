#!/bin/bash
set -euo pipefail

VERSION="0.1.0"
REPO="dishangyijiao/assistant-memory"
DMG_NAME="AssistMem_${VERSION}_aarch64.dmg"
DMG_URL="https://github.com/${REPO}/releases/download/v${VERSION}/${DMG_NAME}"
APP_NAME="AssistMem.app"
INSTALL_DIR="/Applications"

echo "Installing AssistMem ${VERSION}..."

# Download via curl — curl does not set com.apple.quarantine,
# so Gatekeeper will not block the installed app.
TMP_DMG=$(mktemp /tmp/AssistMem.XXXXXX)
mv "$TMP_DMG" "${TMP_DMG}.dmg"
TMP_DMG="${TMP_DMG}.dmg"
curl -fL --progress-bar "$DMG_URL" -o "$TMP_DMG"

# Mount and extract /Volumes path from plist output
MOUNT_POINT=$(hdiutil attach "$TMP_DMG" -nobrowse -plist 2>/dev/null | \
  python3 -c "
import sys, plistlib
d = plistlib.loads(sys.stdin.buffer.read())
for e in d.get('system-entities', []):
    if 'mount-point' in e:
        print(e['mount-point'])
        break
")

if [ -z "$MOUNT_POINT" ]; then
  echo "Error: failed to mount DMG" >&2
  rm -f "$TMP_DMG"
  exit 1
fi

# Install
if [ -d "${INSTALL_DIR}/${APP_NAME}" ]; then
  rm -rf "${INSTALL_DIR}/${APP_NAME}"
fi
cp -R "${MOUNT_POINT}/${APP_NAME}" "${INSTALL_DIR}/"

# Strip any quarantine that may have been inherited (use system xattr, not Homebrew's)
/usr/bin/xattr -r -d com.apple.quarantine "${INSTALL_DIR}/${APP_NAME}" 2>/dev/null || true

# Cleanup
hdiutil detach "$MOUNT_POINT" -quiet
rm -f "$TMP_DMG"

echo ""
echo "✓ AssistMem installed to ${INSTALL_DIR}/${APP_NAME}"
echo "  Open it from Spotlight or your Applications folder."

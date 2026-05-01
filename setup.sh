#!/usr/bin/env bash
# setup.sh — Cabin project bootstrap
# Run once after cloning: bash setup.sh
#
# What this does:
#   1. Verifies UE 5.3 installation path
#   2. Symlinks the CabinBridge plugin into CabinEngine
#   3. Generates UE project files (Makefile / Xcode)
#   4. Verifies Xcode + iPadOS 17 SDK presence
#   5. Opens CabinApp.xcodeproj in Xcode
#   6. Prints next steps
#
# Requirements:
#   - macOS 14+ (Sonoma or Sequoia)
#   - Xcode 15.4+ with iPadOS 17 SDK
#   - Unreal Engine 5.3 installed via Epic Games Launcher
#   - Command Line Tools: xcode-select --install

set -euo pipefail

# ──────────────────────────────────────────────────
# Config — edit these if your paths differ
# ──────────────────────────────────────────────────

UE_VERSION="5.3"
UE_ROOT="/Users/Shared/Epic Games/UE_${UE_VERSION}"
UBT="${UE_ROOT}/Engine/Binaries/DotNET/UnrealBuildTool/UnrealBuildTool"
UE_GENERATE_PROJECT="${UE_ROOT}/Engine/Build/BatchFiles/Mac/GenerateProjectFiles.sh"
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
UPROJECT="${PROJECT_DIR}/CabinEngine/CabinEngine.uproject"
XCODE_PROJ="${PROJECT_DIR}/CabinApp/CabinApp.xcodeproj"
PLUGIN_SRC="${PROJECT_DIR}/CabinBridge"
PLUGIN_DST="${PROJECT_DIR}/CabinEngine/Plugins/CabinBridge"

# Colours
RED='\033[0;31m'; GRN='\033[0;32m'; YLW='\033[0;33m'
BLD='\033[1m';    RST='\033[0m'

log()  { echo -e "${BLD}[Cabin]${RST} $*"; }
ok()   { echo -e "${GRN}${BLD}  ✓${RST} $*"; }
warn() { echo -e "${YLW}${BLD}  ⚠${RST} $*"; }
die()  { echo -e "${RED}${BLD}  ✗ ERROR:${RST} $*" >&2; exit 1; }

echo ""
echo -e "${BLD}╔════════════════════════════════════════╗${RST}"
echo -e "${BLD}║        CABIN — Project Setup          ║${RST}"
echo -e "${BLD}╚════════════════════════════════════════╝${RST}"
echo ""

# ──────────────────────────────────────────────────
# Step 1: Verify Xcode
# ──────────────────────────────────────────────────
log "Checking Xcode…"

if ! command -v xcodebuild &>/dev/null; then
    die "xcodebuild not found. Install Xcode from the App Store."
fi

XCODE_VER=$(xcodebuild -version 2>/dev/null | head -1 | awk '{print $2}')
ok "Xcode $XCODE_VER"

# Check iPadOS SDK.
if ! xcodebuild -showsdks 2>/dev/null | grep -q "iphoneos17"; then
    warn "iPadOS 17 SDK not found in: $(xcodebuild -showsdks | grep iphone || echo 'none')"
    warn "Download the iPadOS 17 SDK in Xcode → Settings → Platforms."
else
    ok "iPadOS 17 SDK present"
fi

# ──────────────────────────────────────────────────
# Step 2: Verify UE 5.3
# ──────────────────────────────────────────────────
log "Checking Unreal Engine ${UE_VERSION}…"

if [ ! -d "${UE_ROOT}" ]; then
    die "UE ${UE_VERSION} not found at: ${UE_ROOT}\n       Install via Epic Games Launcher → Unreal Engine → Library → Add ${UE_VERSION}."
fi
ok "UE ${UE_VERSION} at ${UE_ROOT}"

# ──────────────────────────────────────────────────
# Step 3: Symlink CabinBridge plugin
# ──────────────────────────────────────────────────
log "Symlinking CabinBridge plugin…"

mkdir -p "${PROJECT_DIR}/CabinEngine/Plugins"

if [ -L "${PLUGIN_DST}" ]; then
    ok "Symlink already exists at Plugins/CabinBridge"
elif [ -d "${PLUGIN_DST}" ]; then
    warn "Plugins/CabinBridge exists as a real directory (not symlink). Skipping."
else
    ln -s "${PLUGIN_SRC}" "${PLUGIN_DST}"
    ok "Symlinked CabinBridge -> Plugins/CabinBridge"
fi

# ──────────────────────────────────────────────────
# Step 4: Generate UE project files
# ──────────────────────────────────────────────────
log "Generating UE5 project files (this takes ~30s)…"

if [ ! -f "${UE_GENERATE_PROJECT}" ]; then
    die "GenerateProjectFiles.sh not found at:\n  ${UE_GENERATE_PROJECT}"
fi

bash "${UE_GENERATE_PROJECT}" -project="${UPROJECT}" -game -engine -vscode 2>&1 \
    | grep -E '(ERROR|WARNING|Generating|Done|Took)' || true

ok "UE project files generated"

# ──────────────────────────────────────────────────
# Step 5: Open Xcode
# ──────────────────────────────────────────────────
log "Opening CabinApp in Xcode…"

if [ ! -d "${XCODE_PROJ}" ]; then
    die "Xcode project not found at: ${XCODE_PROJ}"
fi

open "${XCODE_PROJ}"
ok "Xcode opened"

# ──────────────────────────────────────────────────
# Done
# ──────────────────────────────────────────────────
echo ""
echo -e "${GRN}${BLD}╔════════════════════════════════════════╗${RST}"
echo -e "${GRN}${BLD}║  Setup complete. Next steps:        ║${RST}"
echo -e "${GRN}${BLD}╚════════════════════════════════════════╝${RST}"
echo ""
echo "  UNREAL ENGINE:"
echo "  1. Open CabinEngine/CabinEngine.uproject in UE 5.3"
echo "  2. Allow it to compile CabinEngine + CabinBridge modules (~3 min)"
echo "  3. Create MPC_WindowBlend (see Content/BLUEPRINTS.md)"
echo "  4. Create BP_CabinPawn, BP_WindowSystem, BP_MealService, BP_SeatConsole"
echo "     following Content/BLUEPRINTS.md exactly"
echo "  5. Assign 8 media sources to BP_WindowSystem.SeatVideoPlates[]"
echo "  6. Cook for iOS: File → Package → iOS"
echo ""
echo "  XCODE (CabinApp):"
echo "  1. Set your Team in Signing & Capabilities"
echo "  2. Change bundle ID from com.cabin.app to your prefix"
echo "  3. Connect iPad, select it as the run destination"
echo "  4. Product → Run  (Cmd+R)"
echo ""
echo "  SPLIT VIEW TEST:"
echo "  On iPad: open Cabin, then swipe up → drag another app"
echo "  Cabin's AVAudioEngine hum should persist in background."
echo ""

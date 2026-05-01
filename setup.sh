#!/usr/bin/env bash
# setup.sh — Cabin project bootstrap
# Run once after cloning: bash setup.sh
#
# Requirements:
#   - macOS 26+
#   - Xcode 26.4+ with iPadOS 26 SDK
#   - Unreal Engine 5.7.4 installed via Epic Games Launcher

set -euo pipefail

# ──────────────────────────────────────────────────────
# Config — edit UE_ROOT if your install path differs
# ──────────────────────────────────────────────────────

UE_VERSION="5.7"
UE_ROOT="/Users/Shared/Epic Games/UE_${UE_VERSION}"
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
echo -e "${BLD}║    CABIN — Project Setup (UE 5.7.4)   ║${RST}"
echo -e "${BLD}╚════════════════════════════════════════╝${RST}"
echo ""

# ── Step 1: Verify Xcode 26.4 ──────────────────────────
log "Checking Xcode…"

if ! command -v xcodebuild &>/dev/null; then
    die "xcodebuild not found. Install Xcode 26.4 from the App Store."
fi

XCODE_VER=$(xcodebuild -version 2>/dev/null | head -1 | awk '{print $2}')
ok "Xcode $XCODE_VER"

if ! xcodebuild -showsdks 2>/dev/null | grep -q "iphoneos26"; then
    warn "iPadOS 26 SDK not found. Download it in Xcode → Settings → Platforms."
else
    ok "iPadOS 26 SDK present"
fi

# ── Step 2: Verify UE 5.7 ──────────────────────────────
log "Checking Unreal Engine ${UE_VERSION}…"

if [ ! -d "${UE_ROOT}" ]; then
    die "UE ${UE_VERSION} not found at: ${UE_ROOT}\n       Install via Epic Games Launcher → Unreal Engine → Library → + → 5.7"
fi
ok "UE ${UE_VERSION} at ${UE_ROOT}"

# ── Step 3: Symlink CabinBridge plugin ─────────────────
log "Symlinking CabinBridge plugin…"

mkdir -p "${PROJECT_DIR}/CabinEngine/Plugins"

if [ -L "${PLUGIN_DST}" ]; then
    ok "Symlink already exists at Plugins/CabinBridge"
elif [ -d "${PLUGIN_DST}" ]; then
    warn "Plugins/CabinBridge exists as a real directory. Skipping."
else
    ln -s "${PLUGIN_SRC}" "${PLUGIN_DST}"
    ok "Symlinked CabinBridge → Plugins/CabinBridge"
fi

# ── Step 4: Generate UE project files ──────────────────
log "Generating UE 5.7 project files (~30s)…"

if [ ! -f "${UE_GENERATE_PROJECT}" ]; then
    die "GenerateProjectFiles.sh not found at:\n  ${UE_GENERATE_PROJECT}"
fi

bash "${UE_GENERATE_PROJECT}" -project="${UPROJECT}" -game -engine -vscode 2>&1 \
    | grep -E '(ERROR|WARNING|Generating|Done|Took)' || true

ok "UE project files generated"

# ── Step 5: Open Xcode ─────────────────────────────────
log "Opening CabinApp in Xcode 26.4…"

if [ ! -d "${XCODE_PROJ}" ]; then
    die "Xcode project not found at: ${XCODE_PROJ}"
fi

open "${XCODE_PROJ}"
ok "Xcode opened"

# ── Done ───────────────────────────────────────────────
echo ""
echo -e "${GRN}${BLD}╔════════════════════════════════════════╗${RST}"
echo -e "${GRN}${BLD}║  Setup complete. Next steps:          ║${RST}"
echo -e "${GRN}${BLD}╚════════════════════════════════════════╝${RST}"
echo ""
echo "  UNREAL ENGINE 5.7.4:"
echo "  1. Open CabinEngine/CabinEngine.uproject in UE 5.7"
echo "  2. Allow modules to compile (~3 min first time)"
echo "  3. Create MPC_WindowBlend (see Content/BLUEPRINTS.md)"
echo "  4. Create BP_CabinPawn, BP_WindowSystem, BP_MealService, BP_SeatConsole"
echo "  5. Assign 8 media sources to BP_WindowSystem.SeatVideoPlates[]"
echo "  6. Enable Substrate on cabin materials (Edit → Project Settings → Rendering)"
echo "  7. Platforms → iOS → Package Project"
echo ""
echo "  XCODE 26.4:"
echo "  1. Set your Team in Signing & Capabilities"
echo "  2. Change bundle ID from com.cabin.app to your prefix"
echo "  3. Connect iPad (iPadOS 26), select as run destination"
echo "  4. Cmd+R"
echo ""
echo "  NOTES:"
echo "  - Hardware Ray Tracing is now ENABLED (Metal 3, M4 supports MetalRT)"
echo "  - Substrate materials framework is ON — use it for marble/walnut/OLED"
echo "  - Deployment target is iPadOS 26.0"
echo "  - Swift version is 6.0 (strict concurrency on by default)"
echo ""

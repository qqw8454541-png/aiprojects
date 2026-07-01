#!/bin/bash
# ─────────────────────────────────────────────────────────────────
# E2E Test Runner for Android WebView
#
# Prerequisites:
#   - Android SDK with emulator & platform-tools
#   - An AVD (Android Virtual Device) already created
#   - Node.js & npm
#
# Usage:
#   ./e2e/run-e2e.sh              # Build APK + run all E2E tests
#   ./e2e/run-e2e.sh --skip-build # Skip APK build, just run tests
#   ./e2e/run-e2e.sh smoke        # Run only smoke tests
# ─────────────────────────────────────────────────────────────────

set -e

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_DIR" || exit 1

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

SKIP_BUILD=false
TEST_FILTER=""

# Parse arguments
for arg in "$@"; do
  case "$arg" in
    --skip-build) SKIP_BUILD=true ;;
    smoke) TEST_FILTER="smoke" ;;
    game-flow) TEST_FILTER="game-flow" ;;
    *) TEST_FILTER="$arg" ;;
  esac
done

# ─── Step 1: Check prerequisites ────────────────────────────────
echo -e "${BLUE}[e2e] Checking prerequisites...${NC}"

if ! command -v adb &> /dev/null; then
  echo -e "${RED}Error: adb not found. Install Android SDK platform-tools.${NC}"
  exit 1
fi

if ! npx playwright --version &> /dev/null; then
  echo -e "${RED}Error: Playwright not found. Run 'npm install' first.${NC}"
  exit 1
fi

# ─── Step 2: Check for a running emulator/device ────────────────
DEVICE_COUNT=$(adb devices | grep -c "device$" || true)
if [ "$DEVICE_COUNT" -eq 0 ]; then
  echo -e "${YELLOW}[e2e] No Android device/emulator found. Attempting to start one...${NC}"

  # Try to find an available AVD
  AVD_NAME=$(emulator -list-avds 2>/dev/null | head -n 1)
  if [ -z "$AVD_NAME" ]; then
    echo -e "${RED}Error: No AVD found. Create one in Android Studio first.${NC}"
    echo -e "${YELLOW}  Android Studio → Tools → Device Manager → Create Virtual Device${NC}"
    exit 1
  fi

  echo -e "${BLUE}[e2e] Starting emulator: ${AVD_NAME}${NC}"
  emulator -avd "$AVD_NAME" -no-snapshot-load -no-audio -no-window &
  EMULATOR_PID=$!

  # Wait for emulator to boot
  echo -e "${BLUE}[e2e] Waiting for emulator to boot...${NC}"
  adb wait-for-device
  # Wait for boot animation to complete
  while [ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" != "1" ]; do
    sleep 2
  done
  echo -e "${GREEN}[e2e] Emulator booted.${NC}"
fi

# ─── Step 3: Build APK ──────────────────────────────────────────
if [ "$SKIP_BUILD" = false ]; then
  echo -e "${BLUE}========================================${NC}"
  echo -e "${YELLOW}[e2e] Building debug APK...${NC}"
  echo -e "${BLUE}========================================${NC}"
  bash scripts/build_apk.sh only
else
  echo -e "${YELLOW}[e2e] Skipping APK build (--skip-build)${NC}"
fi

# Verify APK exists
APK_PATH="android/app/build/outputs/apk/debug/app-debug.apk"
if [ ! -f "$APK_PATH" ]; then
  echo -e "${RED}Error: APK not found at ${APK_PATH}${NC}"
  echo -e "${YELLOW}Run without --skip-build to build it first.${NC}"
  exit 1
fi

# ─── Step 4: Run E2E tests ──────────────────────────────────────
echo -e "${BLUE}========================================${NC}"
echo -e "${YELLOW}[e2e] Running Playwright E2E tests...${NC}"
echo -e "${BLUE}========================================${NC}"

TEST_CMD="npx playwright test --config e2e/playwright.config.ts"
if [ -n "$TEST_FILTER" ]; then
  TEST_CMD="$TEST_CMD --grep $TEST_FILTER"
fi

eval "$TEST_CMD"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}[e2e] All tests passed!${NC}"
echo -e "${GREEN}========================================${NC}"

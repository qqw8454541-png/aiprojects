#!/bin/bash

# Mahjong Scorer - Android APK Build Script
#
# Usage:
#   ./mahjong-scorer/scripts/build_apk.sh only   - 只编译前端网页代码并将其复制到 Android 目录，然后打出 APK（速度较快，适合仅仅改了前端代码）
#   ./mahjong-scorer/scripts/build_apk.sh sync   - 完整执行前端编译、运行 cap sync 同步原生插件及配置、最后打出 APK（添加/删除原生插件、或者修改了 capacitor 配置时使用）

set -e

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_DIR" || exit 1

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

function check_prerequisites() {
    if ! command -v npm &> /dev/null; then
        echo -e "${RED}Error: npm is not installed.${NC}"
        exit 1
    fi
}

function build_web() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${YELLOW}[1/4] Building Next.js Web App...${NC}"
    echo -e "${BLUE}========================================${NC}"
    export MOBILE_BUILD=true
    npm run build

    echo -e "${BLUE}========================================${NC}"
    echo -e "${YELLOW}[2/4] Processing CSS (Removing unsupported colors)...${NC}"
    echo -e "${BLUE}========================================${NC}"
    node scripts/strip-lab-colors.mjs
}

function build_apk() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${YELLOW}[4/4] Building Android APK via Gradle...${NC}"
    echo -e "${BLUE}========================================${NC}"
    cd android
    ./gradlew assembleDebug
    cd ..

    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}Build Completed Successfully!${NC}"
    echo -e "${GREEN}APK is located at:${NC} android/app/build/outputs/apk/debug/app-debug.apk"
    echo -e "${GREEN}========================================${NC}"
}

function run_only() {
    build_web

    echo -e "${BLUE}========================================${NC}"
    echo -e "${YELLOW}[3/4] Copying Web Assets to Android...${NC}"
    echo -e "${BLUE}========================================${NC}"
    npx cap copy android

    build_apk
}

function run_sync() {
    build_web

    echo -e "${BLUE}========================================${NC}"
    echo -e "${YELLOW}[3/4] Syncing Capacitor Plugins and Web Assets...${NC}"
    echo -e "${BLUE}========================================${NC}"
    npx cap sync android

    build_apk
}

check_prerequisites

case "$1" in
    only)
        echo -e "${GREEN}>>> Starting APK Build (Web Assets Copy Only)...${NC}"
        run_only
        ;;
    sync)
        echo -e "${GREEN}>>> Starting APK Build (Full Plugin Sync)...${NC}"
        run_sync
        ;;
    *)
        echo -e "${YELLOW}Usage: $0 {only|sync}${NC}"
        echo -e "  ${BLUE}only${NC} : 只编译前端网页代码并复制到 Android 目录，然后打出 APK (速度较快)"
        echo -e "  ${BLUE}sync${NC} : 完整编译，包含同步原生 Capacitor 插件及配置，然后打出 APK (添加新插件时使用)"
        exit 1
esac

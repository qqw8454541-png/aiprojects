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

function bump_version() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${YELLOW}[0/4] Auto-incrementing Android versionCode...${NC}"
    echo -e "${BLUE}========================================${NC}"
    
    local gradle_file="android/app/build.gradle"
    if [ ! -f "$gradle_file" ]; then
        echo -e "${RED}Error: $gradle_file not found.${NC}"
        exit 1
    fi

    # 提取当前的 versionCode
    local current_code=$(grep "versionCode " "$gradle_file" | awk '{print $2}')
    if [ -z "$current_code" ]; then
        echo -e "${RED}Error: Could not find versionCode in $gradle_file.${NC}"
        exit 1
    fi
    
    local new_code=$((current_code + 1))
    
    # 替换 versionCode
    sed -i "s/versionCode ${current_code}/versionCode ${new_code}/g" "$gradle_file"
    
    # 也顺便更新 package.json
    npm version patch --no-git-tag-version > /dev/null 2>&1 || true
    local new_name=$(node -p "require('./package.json').version")
    
    # 替换 versionName
    sed -i -E "s/versionName \"[^\"]+\"/versionName \"${new_name}\"/g" "$gradle_file"
    
    echo -e "${GREEN}Bumped versionCode: ${current_code} -> ${new_code}${NC}"
    echo -e "${GREEN}Bumped versionName: -> ${new_name}${NC}"
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

function build_aab() {
    local target="${1:-bundleRelease}"
    echo -e "${BLUE}========================================${NC}"
    echo -e "${YELLOW}[4/4] Building Android App Bundle (AAB - ${target}) via Gradle...${NC}"
    echo -e "${BLUE}========================================${NC}"
    cd android
    ./gradlew "${target}"
    cd ..

    local version_name=$(node -p "require('./package.json').version")

    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}AAB Build Completed Successfully!${NC}"
    if [ "${target}" = "bundleRelease" ]; then
        local original_aab="android/app/build/outputs/bundle/release/app-release.aab"
        local new_aab="android/app/build/outputs/bundle/release/app-v${version_name}-release.aab"
        if [ -f "$original_aab" ]; then
            mv "$original_aab" "$new_aab"
        fi
        echo -e "${GREEN}AAB file is located at:${NC} ${new_aab}"
    else
        local original_aab="android/app/build/outputs/bundle/debug/app-debug.aab"
        local new_aab="android/app/build/outputs/bundle/debug/app-v${version_name}-debug.aab"
        if [ -f "$original_aab" ]; then
            mv "$original_aab" "$new_aab"
        fi
        echo -e "${GREEN}AAB file is located at:${NC} ${new_aab}"
    fi
    echo -e "${GREEN}========================================${NC}"
}

function build_apk() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${YELLOW}[4/4] Building Android APK via Gradle...${NC}"
    echo -e "${BLUE}========================================${NC}"
    cd android
    ./gradlew assembleDebug
    cd ..
    
    local version_name=$(node -p "require('./package.json').version")
    local original_apk="android/app/build/outputs/apk/debug/app-debug.apk"
    local new_apk="android/app/build/outputs/apk/debug/app-v${version_name}-debug.apk"
    
    if [ -f "$original_apk" ]; then
        mv "$original_apk" "$new_apk"
    fi

    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}Build Completed Successfully!${NC}"
    echo -e "${GREEN}APK is located at:${NC} ${new_apk}"
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

function run_aab() {
    local target="${1:-bundleRelease}"
    
    if [ "$target" = "bundleRelease" ]; then
        bump_version
    fi

    build_web

    echo -e "${BLUE}========================================${NC}"
    echo -e "${YELLOW}[3/4] Syncing Capacitor Plugins and Web Assets...${NC}"
    echo -e "${BLUE}========================================${NC}"
    npx cap sync android

    build_aab "${target}"
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
    aab|abb)
        echo -e "${GREEN}>>> Starting AAB Release Bundle Build for Google Play...${NC}"
        run_aab "bundleRelease"
        ;;
    aab:debug)
        echo -e "${GREEN}>>> Starting AAB Debug Bundle Build for Google Play...${NC}"
        run_aab "bundleDebug"
        ;;
    *)
        echo -e "${YELLOW}Usage: $0 {only|sync|aab|aab:debug}${NC}"
        echo -e "  ${BLUE}only${NC}      : 只编译前端网页代码并复制到 Android 目录，然后打出 debug APK (速度较快)"
        echo -e "  ${BLUE}sync${NC}      : 完整编译，包含同步原生 Capacitor 插件及配置，然后打出 debug APK"
        echo -e "  ${BLUE}aab${NC}       : 完整编译并生成用于 Google Play 提交的 Release AAB 包 (bundleRelease)"
        echo -e "  ${BLUE}aab:debug${NC} : 完整编译并生成用于 Google Play 测试的 Debug AAB 包 (bundleDebug)"
        exit 1
esac

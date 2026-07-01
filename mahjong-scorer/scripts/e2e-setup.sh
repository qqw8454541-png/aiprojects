#!/bin/bash
# ─────────────────────────────────────────────────────────────────
# E2E 环境诊断 & 设置脚本
#
# このスクリプトは WSL 環境で Android E2E テストの接続を
# セットアップ・診断します。
#
# 使い方:
#   ./scripts/e2e-setup.sh          # 診断 + 接続テスト
#   ./scripts/e2e-setup.sh --fix    # 問題があれば自動修復
# ─────────────────────────────────────────────────────────────────

# Don't use set -e: grep returns exit 1 when no match, which is expected behavior here

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'
BOLD='\033[1m'

FIX_MODE=false
[[ "$1" == "--fix" ]] && FIX_MODE=true

PASS=0
FAIL=0

check() {
  local label="$1"
  local result="$2"
  if [ "$result" = "ok" ]; then
    echo -e "  ${GREEN}✓${NC} $label"
    ((PASS++))
  else
    echo -e "  ${RED}✗${NC} $label — ${YELLOW}$result${NC}"
    ((FAIL++))
  fi
}

echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║   Mahjong Scorer — E2E 環境診断              ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════════╝${NC}"
echo ""

# ─── 1. WSL 検出 ────────────────────────────────────────────────
echo -e "${BLUE}[1/5] 環境検出${NC}"

IS_WSL=false
if grep -qi microsoft /proc/version 2>/dev/null; then
  IS_WSL=true
  check "WSL 環境を検出" "ok"

  # Windows 側の IP を取得
  WIN_IP=$(cat /etc/resolv.conf | grep nameserver | awk '{print $2}')
  check "Windows ホスト IP: ${WIN_IP}" "ok"
else
  check "ネイティブ Linux 環境 (WSL ではない)" "ok"
fi

# ─── 2. ADB インストール確認 ────────────────────────────────────
echo ""
echo -e "${BLUE}[2/5] ADB 確認${NC}"

if command -v adb &> /dev/null; then
  ADB_VERSION=$(adb --version 2>&1 | head -1)
  check "ADB インストール済み: ${ADB_VERSION}" "ok"
else
  check "ADB 未インストール" "sudo apt install android-tools-adb を実行してください"
  if [ "$FIX_MODE" = true ]; then
    echo -e "  ${YELLOW}→ 自動インストール中...${NC}"
    sudo apt update -qq && sudo apt install -y -qq android-tools-adb
    check "ADB インストール完了" "ok"
  fi
fi

# ─── 3. ADB_SERVER_SOCKET 設定 (WSL のみ) ──────────────────────
echo ""
echo -e "${BLUE}[3/5] ADB 接続設定${NC}"

if [ "$IS_WSL" = true ]; then
  # 環境変数をチェック
  EXPECTED_SOCKET="tcp:${WIN_IP}:5037"

  if [ -n "$ADB_SERVER_SOCKET" ]; then
    check "ADB_SERVER_SOCKET 設定済み: ${ADB_SERVER_SOCKET}" "ok"
  else
    check "ADB_SERVER_SOCKET 未設定" "Windows ADB に接続できません"
    if [ "$FIX_MODE" = true ]; then
      export ADB_SERVER_SOCKET="$EXPECTED_SOCKET"
      # bashrc にも追加（まだない場合）
      if ! grep -q "ADB_SERVER_SOCKET" ~/.bashrc 2>/dev/null; then
        echo 'export ADB_SERVER_SOCKET=tcp:$(cat /etc/resolv.conf | grep nameserver | awk "{print \$2}"):5037' >> ~/.bashrc
        echo -e "  ${YELLOW}→ ~/.bashrc に追加しました。次回から自動設定されます。${NC}"
      fi
      check "ADB_SERVER_SOCKET を設定: ${EXPECTED_SOCKET}" "ok"
    fi
  fi
else
  check "ネイティブ環境: ADB_SERVER_SOCKET 不要" "ok"
fi

# ─── 4. デバイス接続テスト ──────────────────────────────────────
echo ""
echo -e "${BLUE}[4/5] デバイス接続テスト${NC}"

# WSL の場合は環境変数を設定してからテスト
if [ "$IS_WSL" = true ] && [ -z "$ADB_SERVER_SOCKET" ]; then
  export ADB_SERVER_SOCKET="tcp:${WIN_IP}:5037"
fi

# adb devices でデバイスを検出
DEVICES_OUTPUT=$(adb devices 2>&1)
DEVICE_COUNT=$(echo "$DEVICES_OUTPUT" | grep -c "device$" || true)

if echo "$DEVICES_OUTPUT" | grep -q "cannot connect\|Connection refused\|error"; then
  check "ADB サーバー接続" "Windows 側で 'adb start-server' を実行してください"
  echo ""
  echo -e "  ${YELLOW}╭─────────────────────────────────────────────╮${NC}"
  echo -e "  ${YELLOW}│  Windows の PowerShell/CMD で実行:            │${NC}"
  echo -e "  ${YELLOW}│                                               │${NC}"
  echo -e "  ${YELLOW}│    adb kill-server                            │${NC}"
  echo -e "  ${YELLOW}│    adb -a nodaemon server start               │${NC}"
  echo -e "  ${YELLOW}│                                               │${NC}"
  echo -e "  ${YELLOW}│  ※ -a フラグで全 IP からの接続を許可します     │${NC}"
  echo -e "  ${YELLOW}╰─────────────────────────────────────────────╯${NC}"
elif [ "$DEVICE_COUNT" -eq 0 ]; then
  check "Android デバイス" "デバイスが見つかりません。模擬器を起動するか真機を接続してください"
else
  check "Android デバイス: ${DEVICE_COUNT} 台検出" "ok"
  echo "$DEVICES_OUTPUT" | grep "device$" | while read -r line; do
    SERIAL=$(echo "$line" | awk '{print $1}')
    echo -e "    📱 ${SERIAL}"
  done
fi

# ─── 5. APK 確認 ───────────────────────────────────────────────
echo ""
echo -e "${BLUE}[5/5] APK ビルド確認${NC}"

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
APK_PATH="${PROJECT_DIR}/android/app/build/outputs/apk/debug/app-debug.apk"

if [ -f "$APK_PATH" ]; then
  APK_SIZE=$(du -h "$APK_PATH" | awk '{print $1}')
  APK_DATE=$(date -r "$APK_PATH" '+%Y-%m-%d %H:%M')
  check "Debug APK: ${APK_SIZE} (${APK_DATE})" "ok"
else
  check "Debug APK 未ビルド" "'npm run mobile:build:android' または 'bash scripts/build_apk.sh only' を実行"
fi

# ─── 結果サマリー ──────────────────────────────────────────────
echo ""
echo -e "${BOLD}══════════════════════════════════════════════${NC}"
if [ "$FAIL" -eq 0 ]; then
  echo -e "${GREEN}${BOLD}  全チェック通過 (${PASS}/${PASS}) — E2E テスト実行可能です！${NC}"
  echo ""
  echo -e "  実行コマンド:"
  echo -e "    ${BOLD}npm run test:e2e${NC}        # フルビルド + テスト"
  echo -e "    ${BOLD}npm run test:e2e:quick${NC}  # APK ビルドをスキップ"
  echo -e "    ${BOLD}npm run test:e2e:smoke${NC}  # スモークテストのみ"
else
  echo -e "${YELLOW}${BOLD}  ${PASS} 通過 / ${FAIL} 失敗${NC}"
  echo ""
  echo -e "  ${YELLOW}上記の問題を解決してから E2E テストを実行してください。${NC}"
  echo -e "  ${YELLOW}'./scripts/e2e-setup.sh --fix' で自動修復を試行できます。${NC}"
fi
echo -e "${BOLD}══════════════════════════════════════════════${NC}"
echo ""

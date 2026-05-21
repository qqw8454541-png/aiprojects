#!/bin/bash

# Mahjong Scorer - Project Management Script
# Usage: ./mahjong-scorer/scripts/manage.sh [start|stop|status|restart]

SESSION_NAME="mahjong-scorer"
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

cd "$PROJECT_DIR" || exit 1

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

function check_tmux() {
    if ! command -v tmux &> /dev/null; then
        echo -e "${RED}Error: tmux is not installed.${NC}"
        exit 1
    fi
}

function start_services() {
    echo -e "${BLUE}>>> Starting Mahjong Scorer local services...${NC}"

    # 1. Start Frontend in tmux
    echo -e "${YELLOW}[1/1] Starting Next.js dev server in tmux session '$SESSION_NAME'...${NC}"
    if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
        echo -e "${GREEN}Frontend session '$SESSION_NAME' is already running.${NC}"
    else
        tmux new-session -d -s "$SESSION_NAME" -n "next-dev"
        tmux send-keys -t "$SESSION_NAME:next-dev" "npm run dev" C-m
        echo -e "${GREEN}Frontend started in background. Use 'tmux attach -t $SESSION_NAME' to view logs.${NC}"
    fi

    echo -e "${GREEN}>>> All services started successfully!${NC}"
    echo -e "App:    http://localhost:3000"
}

function stop_services() {
    echo -e "${BLUE}>>> Stopping Mahjong Scorer services...${NC}"

    # 1. Stop Frontend tmux session
    if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
        echo -e "${YELLOW}Killing tmux session '$SESSION_NAME'...${NC}"
        tmux kill-session -t "$SESSION_NAME"
        echo -e "${GREEN}Frontend stopped.${NC}"
    else
        echo -e "Frontend session was not running."
    fi

    echo -e "${GREEN}>>> All services stopped.${NC}"
}

function check_status() {
    echo -e "${BLUE}>>> Mahjong Scorer Status Check${NC}"

    # 1. Frontend Status
    echo -e "\n${YELLOW}[Frontend (tmux)]${NC}"
    if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
        echo -e "${GREEN}Session '$SESSION_NAME' is ACTIVE${NC}"
        tmux list-windows -t "$SESSION_NAME"
    else
        echo -e "${RED}Session '$SESSION_NAME' is INACTIVE${NC}"
    fi
}

check_tmux

case "$1" in
    start)
        start_services
        ;;
    stop)
        stop_services
        ;;
    status)
        check_status
        ;;
    restart)
        stop_services
        sleep 2
        start_services
        ;;
    *)
        echo "Usage: $0 {start|stop|status|restart}"
        exit 1
esac

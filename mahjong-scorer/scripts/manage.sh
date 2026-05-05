#!/bin/bash

# Mahjong Scorer - Project Management Script
# Usage: ./scripts/manage.sh [start|stop|status|restart]

SESSION_NAME="mahjong-scorer"
PROJECT_DIR="/root/aiprojects/mahjong-scorer"

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

    # 0. Check for Docker
    if ! docker info > /dev/null 2>&1; then
        echo -e "${RED}Error: Docker is not running. Please start Docker Desktop or the docker daemon.${NC}"
        exit 1
    fi

    # 1. Start Supabase
    echo -e "${YELLOW}[1/2] Starting Supabase local instance...${NC}"
    if npx supabase status &> /dev/null; then
        echo -e "${GREEN}Supabase is already running.${NC}"
    else
        if ! npx supabase start; then
            echo -e "${RED}Error: Failed to start Supabase. Check Docker logs.${NC}"
            exit 1
        fi
    fi

    # 2. Update .env.local with fresh keys
    echo -e "${YELLOW}[2/2] Syncing environment variables...${NC}"
    # supabase status might output non-json warnings before the JSON object
    STATUS_JSON=$(npx supabase status -o json 2>/dev/null | grep -v "^Stopped services" | grep -v "^A new version" | sed -n '/^{/,$p')
    if [ ! -z "$STATUS_JSON" ]; then
        ANON_KEY=$(echo "$STATUS_JSON" | node -e "const fs = require('fs'); try { const data = JSON.parse(fs.readFileSync(0, 'utf-8')); console.log(data.PUBLISHABLE_KEY || data.ANON_KEY || ''); } catch(e) { console.error('JSON parse error:', e); process.exit(1); }")
        if [ ! -z "$ANON_KEY" ] && [ "$ANON_KEY" != "null" ]; then
            # Update NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local
            sed -i "s|^NEXT_PUBLIC_SUPABASE_ANON_KEY=.*|NEXT_PUBLIC_SUPABASE_ANON_KEY=$ANON_KEY|" .env.local
            echo -e "${GREEN}Synced ANON_KEY to .env.local${NC}"
        else
            echo -e "${RED}Warning: ANON_KEY not found in Supabase status.${NC}"
        fi
    else
        echo -e "${RED}Warning: Could not fetch Supabase status for env syncing.${NC}"
    fi

    # 3. Start Frontend in tmux
    echo -e "${YELLOW}[3/3] Starting Next.js dev server in tmux session '$SESSION_NAME'...${NC}"
    if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
        echo -e "${GREEN}Frontend session '$SESSION_NAME' is already running.${NC}"
    else
        tmux new-session -d -s "$SESSION_NAME" -n "next-dev"
        tmux send-keys -t "$SESSION_NAME:next-dev" "npm run dev" C-m
        echo -e "${GREEN}Frontend started in background. Use 'tmux attach -t $SESSION_NAME' to view logs.${NC}"
    fi

    echo -e "${GREEN}>>> All services started successfully!${NC}"
    echo -e "Studio: http://127.0.0.1:54323"
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

    # 2. Stop Supabase
    echo -e "${YELLOW}Stopping Supabase local instance...${NC}"
    npx supabase stop
    echo -e "${GREEN}Supabase stopped.${NC}"

    echo -e "${GREEN}>>> All services stopped.${NC}"
}

function check_status() {
    echo -e "${BLUE}>>> Mahjong Scorer Status Check${NC}"

    # 1. Supabase Status
    echo -e "${YELLOW}[Supabase]${NC}"
    if npx supabase status &> /dev/null; then
        echo -e "${GREEN}Running${NC}"
        npx supabase status | grep -E "Studio URL|REST URL|DB URL"
    else
        echo -e "${RED}Stopped${NC}"
    fi

    # 2. Frontend Status
    echo -e "\n${YELLOW}[Frontend (tmux)]${NC}"
    if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
        echo -e "${GREEN}Session '$SESSION_NAME' is ACTIVE${NC}"
        tmux list-windows -t "$SESSION_NAME"
    else
        echo -e "${RED}Session '$SESSION_NAME' is INACTIVE${NC}"
    fi

    # 3. Docker Containers
    echo -e "\n${YELLOW}[Docker Containers]${NC}"
    docker ps --filter "name=supabase" --format "table {{.Names}}\t{{.Status}}"
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

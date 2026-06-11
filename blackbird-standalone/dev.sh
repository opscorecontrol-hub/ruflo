#!/usr/bin/env bash
# Development mode: backend with --reload + Vite dev server with HMR
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "=== Blackbird 2030 — Dev Mode ==="

# Backend deps
if [ ! -d backend/.venv ]; then
  python3 -m venv backend/.venv
fi
backend/.venv/bin/pip install -q -r backend/requirements.txt

# Frontend deps
cd frontend
[ ! -d node_modules ] && npm install --silent
cd ..

# Start both in parallel
echo "→ Backend  → http://localhost:7799"
echo "→ Frontend → http://localhost:5173  (proxies API to :7799)"
echo ""

backend/.venv/bin/python backend/main.py &
BACK_PID=$!

cd frontend && npm run dev &
FRONT_PID=$!

trap "kill $BACK_PID $FRONT_PID 2>/dev/null; exit" INT TERM
wait

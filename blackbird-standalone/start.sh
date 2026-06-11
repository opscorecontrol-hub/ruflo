#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "=== Blackbird 2030 — AI Software Engineer ==="
echo ""

# ── Backend deps ──────────────────────────────────────────────────────────────
if [ ! -d backend/.venv ]; then
  echo "→ Creating Python virtual environment..."
  python3 -m venv backend/.venv
fi

echo "→ Installing Python dependencies..."
backend/.venv/bin/pip install -q -r backend/requirements.txt

# ── Frontend deps + build ─────────────────────────────────────────────────────
cd frontend
if [ ! -d node_modules ]; then
  echo "→ Installing frontend dependencies..."
  npm install --silent
fi

echo "→ Building frontend..."
npm run build --silent
cd ..

# ── Launch ────────────────────────────────────────────────────────────────────
echo ""
echo "✓ Starting Blackbird 2030 at http://localhost:7799"
echo "  Press Ctrl+C to stop."
echo ""
backend/.venv/bin/python backend/main.py

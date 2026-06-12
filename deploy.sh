#!/usr/bin/env bash
# Blackbird 2030 — One-command deploy to Hetzner CX33
# Usage: bash deploy.sh
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$REPO_DIR"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info()    { echo -e "${CYAN}▸ $*${NC}"; }
success() { echo -e "${GREEN}✓ $*${NC}"; }
warn()    { echo -e "${YELLOW}⚠ $*${NC}"; }
die()     { echo -e "${RED}✗ $*${NC}"; exit 1; }

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║   Blackbird 2030 — Hetzner CX33 Deploy          ║"
echo "║   getOpsCore.com                                 ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""

# ── Prerequisites ─────────────────────────────────────────────────────────────
command -v docker >/dev/null 2>&1 || die "Docker not installed. Run: curl -fsSL https://get.docker.com | sh"
docker compose version >/dev/null 2>&1 || die "Docker Compose plugin not found. Update Docker."

# ── .env check ────────────────────────────────────────────────────────────────
if [ ! -f .env ]; then
  warn ".env not found — creating from .env.example"
  cp .env.example .env
  # Auto-generate JWT_SECRET
  JWT=$(openssl rand -hex 32 2>/dev/null || python3 -c "import secrets; print(secrets.token_hex(32))")
  sed -i "s|change-me-to-64-char-random-string|${JWT}|g" .env
  echo ""
  warn "IMPORTANT: Edit .env and set your API keys before first use:"
  warn "  ANTHROPIC_API_KEY, OPENAI_API_KEY, OPERATOR_EMAIL"
  warn "  Then re-run: bash deploy.sh"
  echo ""
  # Still proceed — app works with local VM provider and no AI keys
fi

# ── Pull latest ───────────────────────────────────────────────────────────────
info "Pulling latest code..."
git pull origin "$(git branch --show-current)" 2>/dev/null || warn "Could not pull (offline or detached HEAD)"

# ── Build images ──────────────────────────────────────────────────────────────
info "Building Docker images..."
docker compose -f docker-compose.opscore.yml build --no-cache

# ── Start / restart stack ─────────────────────────────────────────────────────
info "Starting services..."
docker compose -f docker-compose.opscore.yml up -d

# ── Wait for backend ──────────────────────────────────────────────────────────
info "Waiting for backend to be healthy..."
for i in $(seq 1 30); do
  if curl -sf http://localhost/health >/dev/null 2>&1; then
    break
  fi
  sleep 2
  if [ "$i" -eq 30 ]; then
    warn "Health check timed out — checking logs:"
    docker compose -f docker-compose.opscore.yml logs --tail=20 opscore-backend
  fi
done

# ── Status ────────────────────────────────────────────────────────────────────
echo ""
docker compose -f docker-compose.opscore.yml ps
echo ""

# ── Summary ───────────────────────────────────────────────────────────────────
SERVER_IP=$(curl -sf https://ipv4.icanhazip.com 2>/dev/null || hostname -I | awk '{print $1}')
echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║   Deployment complete!                           ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""
success "OpsCore Dashboard  →  http://${SERVER_IP}/"
success "Ruflo Chat UI      →  http://${SERVER_IP}/chat/"
success "API               →  http://${SERVER_IP}/api/"
success "Health            →  http://${SERVER_IP}/health"
echo ""
info "Logs:    docker compose -f docker-compose.opscore.yml logs -f"
info "Stop:    docker compose -f docker-compose.opscore.yml down"
info "Restart: docker compose -f docker-compose.opscore.yml restart"
echo ""

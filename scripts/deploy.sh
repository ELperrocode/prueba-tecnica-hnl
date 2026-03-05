#!/usr/bin/env bash
# deploy.sh — Deploy BancaHNL to a fresh Ubuntu server (DigitalOcean Droplet)
#
# Usage (from your local machine):
#   ssh root@YOUR_DROPLET_IP 'bash -s' < scripts/deploy.sh
#
# Or copy the repo to the server first, then run it there.

set -euo pipefail

echo "══════════════════════════════════════════════"
echo "  BancaHNL — Production Deploy"
echo "══════════════════════════════════════════════"

# ── 1. Install Docker if not present ────────────────────────────────
if ! command -v docker &> /dev/null; then
    echo "→ Installing Docker..."
    apt-get update -qq
    apt-get install -y -qq ca-certificates curl
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
    chmod a+r /etc/apt/keyrings/docker.asc
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
    apt-get update -qq
    apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin
    echo "✓ Docker installed"
else
    echo "✓ Docker already installed"
fi

# ── 2. Clone repo (or pull if exists) ───────────────────────────────
APP_DIR="/opt/bancahnl"
REPO_URL="${REPO_URL:-}"

if [ -d "$APP_DIR" ]; then
    echo "→ Updating existing deployment..."
    cd "$APP_DIR"
    git pull --ff-only
else
    if [ -z "$REPO_URL" ]; then
        echo "ERROR: Set REPO_URL environment variable to your git repo URL"
        echo "  REPO_URL=https://github.com/user/repo.git bash deploy.sh"
        exit 1
    fi
    echo "→ Cloning repo..."
    git clone "$REPO_URL" "$APP_DIR"
    cd "$APP_DIR"
fi

# ── 3. Check .env exists ────────────────────────────────────────────
if [ ! -f .env ]; then
    echo ""
    echo "ERROR: .env file not found!"
    echo "  cp .env.prod.example .env"
    echo "  nano .env   # fill in your values"
    echo "  Then re-run this script."
    exit 1
fi

# ── 4. Prepare seed data ────────────────────────────────────────────
if [ ! -f data/seed.json ]; then
    echo "→ Preparing seed data..."
    bash setup.sh
fi

# ── 5. Build & start ────────────────────────────────────────────────
echo "→ Building and starting services..."
docker compose -f docker-compose.prod.yml up -d --build --remove-orphans

echo ""
echo "══════════════════════════════════════════════"
echo "  ✓ Deployment complete!"
echo ""
echo "  Services:"
docker compose -f docker-compose.prod.yml ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"
echo ""
echo "  Logs:  docker compose -f docker-compose.prod.yml logs -f"
echo "  Stop:  docker compose -f docker-compose.prod.yml down"
echo "══════════════════════════════════════════════"

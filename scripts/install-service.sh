#!/usr/bin/env bash
# Installs ServerManager++ as a systemd service.
# Usage: sudo ./scripts/install-service.sh [user]   (default user: root)
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then echo "Run with sudo."; exit 1; fi

DIR="$(cd "$(dirname "$0")/.." && pwd)"
RUN_AS="${1:-root}"
NODE="$(command -v node || true)"
if [ -z "$NODE" ]; then echo "Node.js not found. Install Node 18+ first."; exit 1; fi

cd "$DIR"
[ -d node_modules ] || sudo -u "$RUN_AS" npm install --omit=dev

cat > /etc/systemd/system/servermanagerpp.service <<EOF
[Unit]
Description=ServerManager++ web desktop
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$RUN_AS
WorkingDirectory=$DIR
ExecStart=$NODE $DIR/server/index.js
Restart=on-failure
RestartSec=3
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now servermanagerpp
echo
echo "ServerManager++ installed and running as '$RUN_AS'."
echo "Open http://$(hostname -I | awk '{print $1}'):5454"
echo "Logs: journalctl -u servermanagerpp -f"

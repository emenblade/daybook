#!/usr/bin/env bash
set -euo pipefail

if [[ "$(id -u)" -ne 0 ]]; then
	echo "Run as root: sudo ./install.sh [appliance.env]" >&2
	exit 1
fi
if [[ "$(uname -m)" != "x86_64" ]]; then
	echo "This appliance package expects an AMD64/x86_64 machine." >&2
	exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${1:-$SCRIPT_DIR/appliance.env}"
if [[ -f "$ENV_FILE" ]]; then
	set -a
	# shellcheck disable=SC1090
	source "$ENV_FILE"
	set +a
fi

: "${DAYBOOK_DOMAIN:?Set DAYBOOK_DOMAIN, e.g. daybook.herdomain.com}"
: "${CLOUDFLARE_TUNNEL_TOKEN:?Set CLOUDFLARE_TUNNEL_TOKEN from the Cloudflare Tunnel}"
DAYBOOK_IMAGE="${DAYBOOK_IMAGE:-ghcr.io/emenblade/daybook:1.9.0}"
TZ="${TZ:-America/Edmonton}"
DAYBOOK_SETUP_USERNAME="${DAYBOOK_SETUP_USERNAME:-admin}"
DAYBOOK_SETUP_PASSWORD="${DAYBOOK_SETUP_PASSWORD:-$(openssl rand -base64 24)}"
DAYBOOK_USER_NAME="${DAYBOOK_USER_NAME:-Sara}"
DAYBOOK_DB_KEY="${DAYBOOK_DB_KEY:-$(openssl rand -hex 32)}"
BACKUP_PASSPHRASE="${BACKUP_PASSPHRASE:-$(openssl rand -base64 30)}"

if [[ ! "$DAYBOOK_DB_KEY" =~ ^[0-9a-fA-F]{64}$ ]]; then
	echo "DAYBOOK_DB_KEY must be 64 hex characters." >&2
	exit 1
fi

echo "Installing packages..."
apt-get update
apt-get install -y ca-certificates curl jq openssl ufw unattended-upgrades docker.io

if ! docker compose version >/dev/null 2>&1; then
	if ! apt-get install -y docker-compose-v2; then
		apt-get install -y docker-compose
	fi
fi
systemctl enable --now docker

install -d -m 700 /srv/daybook /srv/daybook/data /srv/daybook/secrets /srv/daybook/backups
printf '%s\n' "$DAYBOOK_DB_KEY" > /srv/daybook/secrets/daybook_db_key
printf '%s\n' "$BACKUP_PASSPHRASE" > /srv/daybook/secrets/backup_passphrase
printf '%s\n' "$DAYBOOK_SETUP_PASSWORD" > /srv/daybook/secrets/setup_password
chmod 600 /srv/daybook/secrets/daybook_db_key /srv/daybook/secrets/backup_passphrase /srv/daybook/secrets/setup_password

cat > /srv/daybook/.env <<ENV
DAYBOOK_IMAGE=$DAYBOOK_IMAGE
DAYBOOK_DOMAIN=$DAYBOOK_DOMAIN
CLOUDFLARE_TUNNEL_TOKEN=$CLOUDFLARE_TUNNEL_TOKEN
TZ=$TZ
DAYBOOK_SETUP_USERNAME=$DAYBOOK_SETUP_USERNAME
DAYBOOK_SETUP_PASSWORD=$DAYBOOK_SETUP_PASSWORD
DAYBOOK_USER_NAME=$DAYBOOK_USER_NAME
ENV
chmod 600 /srv/daybook/.env

install -m 600 "$SCRIPT_DIR/compose.yml" /srv/daybook/compose.yml
install -m 700 "$SCRIPT_DIR/backup.sh" /srv/daybook/backup.sh

cat > /etc/systemd/system/daybook-backup.service <<'SERVICE'
[Unit]
Description=Daybook encrypted backup
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
ExecStart=/srv/daybook/backup.sh
SERVICE

cat > /etc/systemd/system/daybook-backup.timer <<'TIMER'
[Unit]
Description=Daily Daybook encrypted backup

[Timer]
OnCalendar=*-*-* 03:15:00
Persistent=true

[Install]
WantedBy=timers.target
TIMER

systemctl daemon-reload
systemctl enable --now daybook-backup.timer

ufw default deny incoming
ufw default allow outgoing
for network in 192.168.0.0/16 10.0.0.0/8 172.16.0.0/12; do
	ufw allow from "$network" to any port 22 proto tcp
done
ufw --force enable

dpkg-reconfigure -f noninteractive unattended-upgrades || true

cd /srv/daybook
if docker compose version >/dev/null 2>&1; then
	docker compose up -d
else
	docker-compose up -d
fi

echo
echo "Daybook appliance is starting."
echo "URL: https://${DAYBOOK_DOMAIN}"
echo "Bootstrap username: ${DAYBOOK_SETUP_USERNAME}"
echo "Bootstrap password: stored in /srv/daybook/secrets/setup_password"
echo "Database key: stored in /srv/daybook/secrets/daybook_db_key"
echo "Backup passphrase: stored in /srv/daybook/secrets/backup_passphrase"
echo
echo "Cloudflare setup: the tunnel public hostname must point to http://daybook:3000."
echo "Change the bootstrap password on first login. Store the key/passphrase offline."

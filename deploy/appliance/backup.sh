#!/usr/bin/env bash
set -euo pipefail
cd /srv/daybook
passphrase="$(cat secrets/backup_passphrase)"
stamp="$(date +%Y-%m-%d_%H%M)"
docker exec \
	-e DAYBOOK_BACKUP_PASSPHRASE="$passphrase" \
	-e DAYBOOK_DB_KEY_FILE=/run/secrets/daybook_db_key \
	daybook \
	node scripts/backup-db.mjs /data/daybook.db "/backups/daybook-${stamp}.db.enc"
find backups -type f -name 'daybook-*.db.enc' -mtime +30 -delete

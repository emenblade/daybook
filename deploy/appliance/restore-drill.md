# Backup restore drill

Run this before relying on the appliance, and repeat periodically.

1. Pick a backup:
   ```bash
   ls -lt /srv/daybook/backups | head
   ```
2. Copy it to a scratch area:
   ```bash
   cp /srv/daybook/backups/daybook-YYYY-MM-DD_HHMM.db.enc /tmp/drill.db.enc
   ```
3. Decrypt it inside the running container:
   ```bash
   docker cp /tmp/drill.db.enc daybook:/tmp/drill.db.enc
   docker exec -e DAYBOOK_BACKUP_PASSPHRASE="$(cat /srv/daybook/secrets/backup_passphrase)" \
     daybook node scripts/decrypt-backup.mjs /tmp/drill.db.enc /tmp/drill.db
   ```
4. Check integrity:
   ```bash
   docker exec daybook node -e "const D=require('better-sqlite3-multiple-ciphers');const db=new D('/tmp/drill.db',{readonly:true});console.log(db.pragma('integrity_check',{simple:true}));db.close()"
   ```
5. Do not replace the live database just to test. If you need a full restore:
   ```bash
   cd /srv/daybook
   docker compose stop daybook
   cp data/daybook.db data/daybook.db.before-restore
   docker cp daybook:/tmp/drill.db data/daybook.db
   docker compose start daybook
   ```
   The app will re-encrypt the restored plaintext database with the appliance
   database key on startup.
6. Delete scratch copies.

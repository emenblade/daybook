# Daybook appliance

A small, always-on AMD64 appliance that runs Daybook locally and publishes it
through a Cloudflare Tunnel. No inbound ports, no dynamic DNS updater, no
router port forwarding, and no developer access after handover.

## Hardware / OS

- AMD64/x86_64 machine, 8 GB RAM, SSD, Ethernet.
- Ubuntu Server 24.04 LTS (minimal) or Debian 12.
- The device should be hers and use her Cloudflare account.

## Cloudflare setup (one time)

1. Put `herdomain.com` on Cloudflare DNS.
2. Cloudflare Zero Trust → Networks → Tunnels → **Create a tunnel**.
3. Name it `daybook`.
4. Add a **Public Hostname**:
   - Subdomain: `daybook`
   - Domain: `herdomain.com`
   - Service: `http://daybook:3000`
5. Copy the **tunnel token**.
6. Do **not** port-forward 80/443. The tunnel is outbound-only.

Using a tunnel means there is nothing to update when her home IP changes, and
the appliance works from any network without NAT loopback. A Cloudflare API key
is not needed.

## Install

Copy this directory and a private `appliance.env` to the freshly installed
machine, then run:

```bash
sudo ./install.sh /path/to/appliance.env
```

`appliance.env` is based on `appliance.env.example`. Keep it private; it contains
the tunnel token and the first-run password. The installer:

- installs Docker and Docker Compose;
- creates `/srv/daybook/{data,backups,secrets}`;
- stores the SQLCipher key, setup password, and backup passphrase in mode-600 files;
- writes a mode-600 `.env`;
- starts Daybook and Cloudflared;
- enables a daily encrypted backup timer at 03:15;
- enables UFW (inbound denied; SSH allowed from RFC1918 LAN ranges only);
- enables unattended OS security updates.

It does **not** publish an app port. The only path in is Cloudflare Tunnel.

## First login

Open `https://daybook.herdomain.com`.

- Bootstrap username/password are in `appliance.env`; the password is also saved
  in `/srv/daybook/secrets/setup_password`.
- Daybook forces a permanent username/password before the app can be used.
- Store the database key (`/srv/daybook/secrets/daybook_db_key`) and backup
  passphrase offline, separate from the device.

## Golden image / handover

1. Test the full flow at your place.
2. Shut down the machine.
3. Clone the disk with Clonezilla, `dd`, or your preferred imaging tool.
4. Boot the clone once to confirm the tunnel and app start.
5. Change the OS admin password, remove any SSH keys that are yours, and make
   sure her Cloudflare account owns the tunnel.
6. Delete your copies of the disk, database, keys, and backups.

If the tunnel token is ever rotated, update `/srv/daybook/.env` and run:

```bash
cd /srv/daybook
docker compose up -d
```

## Updates

The Daybook image is pinned in `appliance.env` (`DAYBOOK_IMAGE`). Do not use
automatic app updates. To update:

```bash
cd /srv/daybook
# edit .env and change DAYBOOK_IMAGE to the new version
docker compose pull
docker compose up -d
```

OS security updates run automatically. Test after each app update. Since the
app image is pinned, an unattended reboot will not silently change versions.

## Backups

- `/srv/daybook/backups/daybook-YYYY-MM-DD_HHMM.db.enc` daily at 03:15.
- Backups are encrypted with the backup passphrase, independent of the DB key.
- Copy backups off the device regularly (USB SSD, encrypted storage).
- Retention is currently 30 days; adjust `/srv/daybook/backup.sh` if needed.

See `restore-drill.md` for the restore procedure.

## Security notes

- No inbound ports; Cloudflare Tunnel is outbound.
- App login has rate limiting and secure cookies.
- The database is SQLCipher-encrypted; the key is on this device.
- The key and backup passphrase are separate and should be stored offline.
- If the device is stolen while running, a root attacker can read the live DB.
  Full-disk encryption is still recommended where practical.

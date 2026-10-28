# Daybook on Unraid — install guide

Daybook is published as a container image here:

- **GitHub repo:** https://github.com/emenblade/daybook
- **Image:** `ghcr.io/emenblade/daybook:latest`
- **Unraid template:** `daybook.xml`
- **Local/offline fallback:** `daybook-local.xml` + `image/daybook-1.2.1-amd64.tar`

The app is LAN/VPN-only. Do not port-forward it to the internet.

## What is in this folder

```
calendar app/
├── INSTALL-UNRAID.md              ← this file
├── README.md                      ← app, calendar and device documentation
├── CALENDAR-SETUP-GUIDE.md        ← Jane feed and private iCloud options
├── ANDROID-KIOSK-GUIDE.md         ← lock down an Android/e-ink tablet
├── guides/                        ← printable PDFs
├── daybook.xml                    ← install from GHCR (recommended)
├── daybook-local.xml              ← install from the offline tar
├── image/                         ← optional offline image
│   ├── daybook-1.2.1-amd64.tar
│   ├── daybook-1.2.1-amd64.tar.gz
│   └── SHA256SUMS
├── source/                        ← complete source (build/push to GitHub)
├── screenshots/
└── sample-calendar.ics
```

## 1. Install from GHCR (recommended)

The image is built and published by GitHub Actions from the repo above; Unraid
will pull it directly. No `docker load` is needed.

```bash
mkdir -p /mnt/user/appdata/daybook
cp "/mnt/user/share/calendar app/daybook.xml" \
   /boot/config/plugins/dockerMan/templates-user/daybook.xml
```

Then in Unraid: **Docker → Add Container → Daybook**, check the settings
(especially **TZ**) and click **Apply**. Unraid pulls
`ghcr.io/emenblade/daybook:latest`.

If you prefer a one-off test container:

```bash
docker run -d --name daybook --restart unless-stopped \
  -p 8484:3000 \
  -e TZ=America/Edmonton \
  -v /mnt/user/appdata/daybook:/data \
  ghcr.io/emenblade/daybook:latest
```

The container runs as root inside the container (same as StreamAssets), so the data path does not need a host chown. If you see `SQLITE_CANTOPEN`, verify the `/data` volume mapping and `DATABASE_PATH`.

## 2. First run

1. Open `http://<nas-ip>:8484`.
2. Sign in with PIN **1111**.
3. **Settings:** change the PIN, set the timezone/name, and adjust the 3-day
   reminder and 60-day follow-up thresholds if desired.
4. **Settings → Remove demo data**.
5. **Sync → Calendar source → ICS feed URL** → paste the Jane link → **Save** →
   **Sync now**.
6. Check **Recent calendar events** and then the **Overview**/`/kiosk`.

No iPhone access is needed when using the Jane link. The link is a secret; treat
it like a password and do not put it in screenshots or the repo. The calendar
guide has the optional private iCloud path.

> **History note:** Jane's iCal feed starts about 30 days before the current
> date. Follow-up detection (60 days) and year-to-date hours become fully
> accurate as Daybook accumulates history. If Jane can export historical
> appointments/client data, we can add an import.

## 3. Optional: offline install from the bundled image

If GHCR is unreachable, the bundle includes the same image as a file:

```bash
docker load -i "/mnt/user/share/calendar app/image/daybook-1.2.1-amd64.tar"
docker images | grep daybook
mkdir -p /mnt/user/appdata/daybook
cp "/mnt/user/share/calendar app/daybook-local.xml" \
   /boot/config/plugins/dockerMan/templates-user/daybook-local.xml
```

Then add **Daybook (local)** from the Unraid templates. `daybook-local.xml`
uses `daybook:latest` from the loaded file; `daybook.xml` uses GHCR.

## 4. Optional: build from source on the NAS

Copy `source/` to the NAS and run:

```bash
cd /mnt/user/appdata/daybook-src
docker compose up -d --build
```

## Updates and backups

- **GHCR install:** Unraid → Docker → Daybook → **Check for Updates** pulls the
  latest published image. Recreate the container; `/data` is untouched.
- **Local install:** load a newer tar and recreate the container.
- Database: `/mnt/user/appdata/daybook/daybook.db`; back up that folder or use
  **Settings → Download backup**.
- The first Actions build must finish before the GHCR template can pull. If the
  image is not available yet, check the repo's **Actions** tab.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `pull access denied` / manifest unknown | The GitHub Actions image build has not finished, or the package is not public. Check Actions/GHCR. |
| `SQLITE_CANTOPEN` | Check that `/mnt/user/appdata/daybook` is mapped to `/data` and `DATABASE_PATH=/data/daybook.db`; the container runs as root. |
| Times are wrong | Set `TZ=America/Edmonton` (or her zone) and recreate the container. |
| Jane sync fails | The Sync screen shows the error; confirm the link still works and has not been rotated. |
| Kiosk asks for PIN constantly | Do not use private/incognito mode; Fully Kiosk should keep cookies. |
| Follow-up list is empty | Expected until the app has enough feed history (see the note above). |

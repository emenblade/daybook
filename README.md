# Daybook

A small, self-hosted companion for one practitioner who lives out of a Jane-fed
iCloud calendar and needs to stay ahead of session notes and client follow-ups.

- **Calendar-driven.** Every day the server pulls her Jane iCal feed (or an
  iCloud CalDAV account), parses appointments into clients, groups couples,
  families, and DBT sessions, and records every session: who, when, how long, how
  often, and how many hours.
- **Desk device.** A touch-first `/kiosk` view shows today's plan. Each session
  has two big confirmations: **No-show** and **Done + notes**. No note-taking —
  just the paperwork status she needs to get paid.
- **Never lose track.** Appointments that stay unconfirmed for 3 days land in a
  cleanup list; after 5pm the desk screen shows a reminder banner until notes are
  marked done in Jane. Work meetings and breaks are shown separately and never
  generate reminders.
- **Long-term reminders.** A client with no future booking and no completed
  session for 30+ days (adjustable, 1–365) is surfaced so she can mark them
  **Follow up** or **Discharged**. Consent forms and treatment-plan paperwork
  live in the same long-term list.
- **Consent forms.** Every client has a consent-for-service checkbox. It stays on
  session cards and in the long-term list until marked signed.
- **Treatment plans.** A plan is due by the end of the client's third session.
  If it is still missing, it stays on future cards and in the long-term list.
  Plans are reviewed every 90 days and remade every year; when a booked session
  falls within a week of the due date (or later), the long-term list shows the
  upcoming review and the session card gets the matching checkbox.
- **Hours.** Totals by week, month, and year, plus a session-type breakdown and
  CSV export. Couples/group sessions are counted once, not once per attendee.
- **LAN-only.** One Docker container + one SQLite file. The desk device reaches it
  over WireGuard (or Tailscale). Nothing is exposed to the internet.

> **History limitation:** Jane's iCal feed starts about 30 days before today.
> The app cannot see clients or sessions older than that. Follow-up detection
> (30 days) and year-to-date hours become fully accurate only after the app has
> been running/accumulating history. If Jane can export historical appointments
> or a client list, we can add an import to seed that history.

## The two sides

| Side | What it is |
| --- | --- |
| **Server** | This app in Docker on the NAS. Syncs the calendar on a schedule, stores clients/sessions/hours, runs reminders, serves the API/UI. |
| **Client** | Any browser, really. The dedicated device is a Raspberry Pi + touchscreen in Chromium kiosk mode pointed at `/kiosk`; see [Desk device](#desk-device). A phone/tablet browser works too. |

## Quick start (demo)

```bash
npm install
npm run dev -- --open
```

PIN: `1111` (change it in **Settings**). On first run the database is seeded with
three months of realistic demo data: today's board, unconfirmed sessions, two
clients who need follow-up, missing and due treatment plans, unsigned consent
forms, and upcoming appointments. The seed is relative to the day you first run
it.

When you are ready for real data: **Settings → Remove demo data**, then connect
the calendar on **Sync**.

## Connecting her calendar

A plain-language walkthrough is in **`CALENDAR-SETUP-GUIDE.md`**
(printable PDF: `guides/calendar-setup.pdf`). For this setup, **use the Jane
iCal link first** — it is automatic, read-only, and needs no iPhone access:

### 1. Jane iCal feed (recommended, already available)

In Daybook: **Sync → Calendar source → ICS feed URL** → paste the link she sent
you → **Save → Sync now**. That is the whole setup. The first sync imports recent
history; after that it runs daily at the configured time.

The link is a secret: anyone with it can read the calendar. Treat it like a
password. The app stores it only in the local database.

### 2. iCloud CalDAV (private alternative)

1. Create an **app-specific password** at [appleid.apple.com](https://appleid.apple.com)
   (Sign-In and Security → App-Specific Passwords).
2. In Daybook: **Sync → Calendar source → iCloud CalDAV**, enter her Apple ID,
   the app-specific password, and optionally the calendar name (e.g. `Work`).
3. Save, then **Sync now**.

The password is stored in the local SQLite database (on your NAS), never sent
anywhere else. Backups of the database contain it — treat backups accordingly.

### 3. iCloud public calendar link (only if needed)

If the Jane link is unavailable, an iCloud public link can be used the same way
(Calendar → Share → Public Calendar → Copy Link → paste into **Sync → ICS feed
URL**). Anyone with the link can read it; the Jane feed is the simpler path.

### Jane formatting (tested against the live feed)

The defaults match the real Jane titles:

- `First L. (Service)` → one client + service (In-Person, Video, Phone, WCB,
  Pro Bono, Consultation, …).
- Same-time **couples/family** events → one appointment with both names.
- **DBT Group** events → one group appointment with all attendees and a Group
  badge; one confirmation, counted once.
- `Break - …` → non-client. Work meetings/admin appear as muted “Other” entries;
  lunch/routine breaks are hidden. They never generate reminders.

The **Sync** screen shows every incoming event with the client/service it parsed
(or its category), a rule editor (regex with a `(?<client>…)` group), and a test
box. A `sample-calendar.ics` file is included for testing **Upload & parse**.

### History on first sync

The first successful sync imports the last 180 days of events as **completed
history** (so client frequency, hours, and “last seen” are useful immediately)
without creating a backlog of fake reminders. From that day forward, sessions
start as **To confirm** and the 3-day reminder clock applies.

## Reminders

- **On the desk device:** the cleanup list is always visible, with the two
  confirmations inline. After the reminder time (default 5:00 PM, configurable)
  a banner appears on the desk screen while anything is outstanding — no email,
  no push service, nothing else to break.
- **Follow-up:** last *completed* session at least 30 days ago (configurable),
  no future booking, status still active. Marking **Follow up** or **Discharged**
  clears the alert and is visible in the client history. A future booking always
  suppresses the follow-up reminder.
- **Treatment plans:** missing after the third completed session, or due for a
  90-day review / annual remake. The long-term list shows upcoming reviews when a
  booked session falls within a week of the due date or later; the session card
  carries the matching checkbox. Missing plans stay on every future card until
  marked complete.
- **Consent forms:** unsigned consent stays on session cards and in the long-term
  list until marked. Marking is available from the desk view, client list, or
  client detail.

## Deploy on Unraid

The app is published from GitHub as a container image:

- **Repo:** https://github.com/emenblade/daybook
- **Image:** `ghcr.io/emenblade/daybook:latest`
- **Unraid template:** `daybook.xml`

```bash
mkdir -p /mnt/user/appdata/daybook
cp "/mnt/user/share/calendar app/daybook.xml" \
   /boot/config/plugins/dockerMan/templates-user/daybook.xml
```

Then add **Daybook** from the Unraid Docker templates; Unraid pulls the GHCR
image. Set `TZ` (default `America/Edmonton`). No `docker load` is required.

To build from source instead: `cd source && docker compose up -d --build`.

| Variable | Default | Purpose |
| --- | --- | --- |
| `TZ` | `UTC` | **Set this.** Controls “today”, the 5pm banner, and displayed times. |
| `DATABASE_PATH` | `/data/daybook.db` | SQLite file |

Backups: **Settings → Download backup**, or copy the `data/` volume while the
container is stopped. CSV exports from **Hours** cover tax records.

## Desk device

Recommended: a cheap Android e-ink tablet (Boox/Meebook/Hisense) or any Android
tablet in Fully Kiosk Browser. Step-by-step lock-down instructions are in
**`ANDROID-KIOSK-GUIDE.md`** (one-page checklist: `guides/kiosk-checklist.pdf`).
The kiosk layout is built for 1280×800 landscape and also works stacked on
phones.

1. Install Raspberry Pi OS (64-bit Desktop) and connect the touchscreen.
2. Join the NAS VPN (WireGuard):
   ```
   sudo apt install wireguard
   sudo cp wg0.conf /etc/wireguard/wg0.conf
   sudo systemctl enable --now wg-quick@wg0   # adjust interface name
   ```
   (Tailscale is a WireGuard-based alternative with less paperwork.)
3. Point Chromium at `http://<nas-wireguard-ip>:8484/kiosk`, sign in once with the
   PIN, and let the session cookie persist. Add to home screen / use kiosk flags:
   ```
   chromium --kiosk --noerrdialogs --disable-infobars \
     --user-data-dir=$HOME/.config/daybook-kiosk \
     http://<nas-wireguard-ip>:8484/kiosk
   ```
4. Autostart that command on login and disable screen blanking (`xset s off;
   xset -dpms`). The kiosk refreshes itself every minute and wakes on tap.

The device only needs the WireGuard tunnel; the app never has to be exposed to
the open internet. If the login expires, the kiosk redirects to the PIN screen
and returns to `/kiosk` afterwards.

### E-ink displays

Two practical routes, cheapest first:

1. **Android e-ink tablet** (Boox, Meebook, Hisense — often under $150 used) with
   any browser: open `/kiosk?eink=1`. That mode greys the palette, removes
   shadows/animations, uses thicker borders, and refreshes every 5 minutes
   instead of every minute to reduce ghosting. There is also a manual
   **Refresh** button in the header. This is the zero-extra-software option.
2. **Raspberry Pi + raw e-ink panel** (Waveshare 7.5"/10.3", around $60–100):
   a bare SPI panel cannot run Chromium, so it needs a tiny custom renderer
   (Python + panel driver) that draws today's plan and reads two physical
   buttons. The server side is ready for it; tell me the panel model and I can
   add an `/api/eink/today` endpoint and a matching client. Not included yet.

E-ink tip: keep the device in light mode; the grayscale filter is designed for it.

## Stack

SvelteKit (Svelte 5) + adapter-node, SQLite (better-sqlite3), Tailwind CSS v4,
`ical.js` for parsing, `tsdav` for CalDAV, PWA manifest and kiosk-friendly
layout. Daily sync and reminder scheduling run
in-process (no cron sidecar).

## Not included

Actual clinical notes, editing the calendar, recurring-event expansion (first
occurrence only), multi-practitioner support, invoicing, SMS/email/push
notifications (the desk device is the reminder surface), and multi-device kiosk
provisioning. The data model leaves room for these.

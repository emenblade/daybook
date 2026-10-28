# Connecting her Jane calendar to Daybook

You already have the **Jane iCal link** for her appointment calendar. That is the
easiest and best path — you do not need her iPhone, her Apple ID, or an
app-specific password.

## Use the Jane link (recommended, tested)

1. Open Daybook → **Sync** (refresh icon at the top).
2. Under **Calendar source**, choose **ICS feed URL**.
3. Paste the Jane link (the one she sent you). It looks like
   `https://…janeapp.com/ical/…/appointments.ics`.
4. Set the **daily sync time** (default 03:30).
5. Tap **Save calendar source**, then **Sync now**.
6. Check **Recent calendar events**:
   - Jane titles look like `First L. (In-Person FNIHB/IRS/Bigstone)`.
   - Break/lunch entries should show as `Break`, `Work`, or `Personal`, not as
     client sessions.
   - Couples show both names; DBT shows all attendees and a **Group** badge.

That's it. The server pulls this feed every day and keeps the local database in
sync. The first sync imports recent history as completed so the client list and
hours are useful immediately; appointments from today onward wait for
confirmation.

### Privacy: the link is a password

The Jane link is a secret read-only URL. Anyone who has it can read the
appointment calendar, including client initials and schedule. Treat it like a
password:

- Do not paste it into messages, tickets, or screenshots.
- Daybook stores it in its local SQLite database on your NAS.
- If it is ever exposed, regenerate/revoke the feed in Jane and paste the new
  URL into Daybook.
- The app itself stays LAN/VPN-only; the feed is only fetched by your server.

## What the feed contains (from the live analysis)

- Client appointments: `First L. (Service)` — individual, couples, family,
  phone, video, WCB, pro bono, consultations, and DBT group.
- Non-client blocks: everything starting with `Break - …` (lunch, vacation,
  meetings, prep, personal appointments).
- No all-day events, no recurring events, and Jane removes canceled events.
- Times are in `America/Edmonton`; the server container should use that `TZ`
  (or her actual timezone) so “today” and the 5 PM reminder are correct.

Daybook groups same-time couples/family events into one appointment with both
names, and DBT group events into one appointment with all attendees. One
confirmation covers the appointment, and hours are counted once. Work meetings
appear on the calendar as non-actionable “Other” entries; routine lunch/break
blocks are hidden.

## Optional: private iCloud access instead

If you ever want to stop using the Jane link, or Jane rotates it and you prefer
account access, use iCloud CalDAV. This requires her cooperation because Apple
requires an app-specific password.

### On her iPhone (read this to her)

1. Open **Settings** → tap **her name/photo** at the top.
2. Tap **Sign-In & Security** (older iOS: **Password & Security**).
3. Tap **App-Specific Passwords**.
4. Tap **Generate Password** (or **+**), name it **Daybook**, tap **Create**.
5. Use Face ID or her passcode.
6. Copy the four-group password and send it to you, plus the Apple ID email shown
   at the top of Settings.
7. Open **Calendar** → **Calendars** at the bottom → find the calendar Jane uses
   and note its exact name.

If “App-Specific Passwords” is missing, two-factor authentication is off or the
Apple ID is managed by an employer/school; use the Jane link instead.

### In Daybook (you)

1. **Sync → Calendar source → iCloud CalDAV**.
2. Server: `https://caldav.icloud.com`.
3. Apple ID: her email.
4. Password: the app-specific password (not her main Apple ID password).
5. Calendar name: exact name, or leave blank to use the first calendar.
6. **Save → Sync now** → check **Recent calendar events**.

The password is stored in the local database. Revoke it any time at
appleid.apple.com → Sign-In and Security → App-Specific Passwords.

## Troubleshooting

| What you see | Fix |
| --- | --- |
| `401/403` on CalDAV | Wrong Apple ID or password; must be an app-specific password. |
| “Calendar not found” | Exact name mismatch; use one of the names listed in the error, or leave blank. |
| Sync succeeds but no sessions | Jane is writing to a different calendar; check **Recent calendar events**. |
| Client names don't match | Use **Sync → Parsing rules → Test parse**; the Jane defaults should match `First L. (Service)`. |
| Times look shifted | Set the container `TZ` to `America/Edmonton`; check the kiosk/tablet timezone. |
| The Jane link stops working | Get a fresh link from Jane and paste it into **Sync**, then run **Sync now**. |

## What not to do

- Do not send her main Apple ID password.
- Do not share the Jane link publicly.
- Do not create a new Apple ID or a new calendar for this.

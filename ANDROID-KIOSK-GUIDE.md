# Turning an Android tablet into the Daybook desk screen

Goal: a tablet that boots straight into Daybook, cannot wander to other apps or
websites, keeps the screen awake, reconnects automatically, and shows the 5 PM
reminder banner. No special hardware needed.

## What you need

- An Android tablet, Android **9 or newer**, 2 GB+ RAM. A 10" screen is ideal.
  A cheap **Android e-ink tablet** (Boox, Meebook, Hisense) works; a normal LCD
  tablet works too.
- The tablet's charger, kept plugged in.
- Wi-Fi at her desk.
- **Fully Kiosk Browser** (free; PRO removes the watermark and adds remote admin).
- **WireGuard** (or Tailscale) to reach the NAS.
- The NAS's WireGuard IP (e.g. `10.6.0.2`) and Daybook port (`8484` by default).

The Daybook kiosk itself is locked down: it has no admin links or bottom
navigation, only today's plan, the cleanup list, long-term reminders, and a Refresh
button in e-ink mode.

---

## 1. Network: always-on VPN

The tablet must be able to reach the NAS from her desk without anyone touching it.

1. Connect the tablet to Wi-Fi.
2. Install **WireGuard** from the Play Store.
3. On the NAS, create a peer/QR code for the tablet (in your WireGuard config —
   the same way you added your phone). Import it in the Android app.
4. In Android: **Settings → Network & Internet → VPN → WireGuard → gear icon**:
   - Enable **Always-on VPN**.
   - Enable **Block connections without VPN** (keeps the kiosk from silently
     using an unprotected connection).
5. Test: open a browser and go to `http://<NAS_WG_IP>:8484/login`. You should see
   the Daybook login screen.

Tailscale alternative: install Tailscale, sign in, and enable Android's
always-on VPN for it. Tailscale starts on boot automatically.

## 2. Install Fully Kiosk Browser

1. Install **Fully Kiosk Browser** from the Play Store. On e-ink devices without
   Play Services, download the APK from fully-kiosk.com and install it.
2. Open it once and allow the permissions it asks for (storage, network, etc.).
3. If the free version shows a watermark, that is cosmetic; the PRO license
   removes it and enables remote administration.

## 3. Point it at Daybook

In Fully Kiosk: **Settings → Web Content Settings**:

- **Start URL**:
  - E-ink tablet: `http://<NAS_WG_IP>:8484/kiosk?eink=1`
  - LCD tablet: `http://<NAS_WG_IP>:8484/kiosk`
- Enable **JavaScript** and **Cookies** (required).
- Disable any “clear cookies on exit” option.
- Set **Screen Orientation** to landscape.
- If asked about “Load start URL on restart”, enable it.

Tap the home/back gesture to return to the page and log in once with the username and password.
Fully stores the cookie, so it should not ask again on restart.

## 4. Lock it down (the important part)

In Fully Kiosk settings, enable/find:

| Setting | Value / action |
| --- | --- |
| **Kiosk Mode / Lock** | On. Set a long settings PIN. This stops leaving the app. |
| **Start on Boot / Autostart** | On |
| **Keep Screen On** | On |
| **Restart App on Crash** | On |
| **Reload on Reconnect** | On |
| **Reload on Network Error** | On, if present |
| **Address bar / navigation** | Hidden/disabled |
| **Status bar / navigation bar** | Disable/hide (on newer Android this may need extra permissions) |
| **Website whitelist** (PRO) | Allow only `http://<NAS_WG_IP>:8484/*` |
| **Set as Home app** | See below |
| **Motion detection / wake** | Optional; not needed if screen stays on |

Then set Fully as the tablet's Home app:

**Android Settings → Apps → Default apps → Home app → Fully Kiosk Browser.**

This means the Home button always returns to Daybook, and it starts automatically
after a reboot.

## 5. Android settings for reliability

- **Battery:** Settings → Apps → Fully Kiosk → Battery → **Unrestricted** (also
  called “Don’t optimise”). Otherwise Android may kill it.
- **Screen lock:** for a desk device, set Android's screen lock to **None** so it
  wakes straight to the kiosk after a reboot. Fully's own settings PIN still
  protects configuration. If you need the tablet locked at night, use Fully's
  screen-off schedule instead.
- **Stay awake:** if available, Developer options → **Stay awake while charging**.
  Fully's “Keep screen on” is usually enough.
- **Auto-updates:** in the Play Store, open Fully Kiosk's page and turn off
  **Enable auto update**. Update it manually occasionally and test afterwards.
  Android system updates can change kiosk behaviour; test after any update.
- **Screen timeout:** set to the longest setting / Never. Fully overrides this,
  but setting it helps.
- **Date & time:** Automatic.
- **Notifications:** turn off non-essential notifications; they can pop over the
  kiosk on some devices.

## 6. E-ink specifics

- Use the `?eink=1` URL. It switches to grayscale, removes shadows/animations,
  and refreshes every 5 minutes instead of every minute.
- Keep the device in **light mode**.
- On Boox: set the Fully app's refresh mode to **Normal** or **Regal**, disable
  system navigation gestures if possible, and set the screen timeout to Never.
- E-ink ghosting is normal. The 5-minute refresh redraws the page; use the
  device's manual refresh gesture if it gets muddy.
- E-ink tablets are usually slow to boot. Give it a minute after power-on.

## 7. Test checklist (do this before handing it over)

- [ ] Reboot the tablet. Does it come back to Daybook without touching anything?
- [ ] If the Wi-Fi drops and comes back, does the page recover?
- [ ] Unplug the charger and plug it back in; the screen should stay on / wake.
- [ ] Tap the Home button — Daybook should be the only home screen.
- [ ] Tap around the kiosk; there should be no way to reach Settings or another
      app without the Fully PIN.
- [ ] Mark one session “No-show”, undo it, mark it “Done + notes” — the kiosk
      updates without leaving the page.
- [ ] Leave it overnight; the next morning it should still show the kiosk.
- [ ] After 5 PM with an unconfirmed session, the reminder banner appears. Clear
      the session and confirm the banner goes away.

## 8. If something goes wrong

| Symptom | Fix |
| --- | --- |
| Browser error / “can’t reach page” | VPN is down. Open WireGuard, reconnect. Fully reloads on reconnect if enabled. |
| Login screen after a restart | Log in again; the cookie lasts 90 days. If it happens constantly, make sure Fully is not clearing cookies on exit. |
| Kiosk shows an old day | Pull to refresh / tap Refresh (e-ink) / wait for the 5-minute refresh. Check the tablet's date/time. |
| Fully keeps closing | Battery optimisation is still on. Set the app to Unrestricted. |
| Tablet is sluggish | E-ink devices are slow; avoid animations (we already disable them in e-ink mode), close other apps. |
| Someone changed settings | Fully's PIN protects them. If lost, clear app data and reconfigure. |

## Notes

- The tablet is a trusted LAN/VPN device. Do not port-forward Daybook to the
  internet.
- The kiosk's admin screens are deliberately not linked from `/kiosk`; use your
  own phone/browser for the admin UI.
- A tablet with a battery also survives short power outages — it keeps running
  on battery. Keep it plugged in for long-term use.

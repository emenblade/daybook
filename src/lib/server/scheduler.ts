import { building } from '$app/env';
import { parseTimeToMin, todayISO } from '#lib/dates.ts';
import { getCalendarConfig, getSetting, setSetting } from './settings.ts';
import { syncCalendar } from './sync.ts';

const globalRef = globalThis as unknown as { __daybook_scheduler_started?: boolean };
let ticking = false;

export function startScheduler(): void {
	if (building || globalRef.__daybook_scheduler_started) return;
	globalRef.__daybook_scheduler_started = true;
	setTimeout(() => void tick(), 15_000);
	setInterval(() => void tick(), 60_000);
	console.log('[daybook] scheduler started');
}

async function tick(): Promise<void> {
	if (ticking) return;
	ticking = true;
	try {
		const now = new Date();
		const minutes = now.getHours() * 60 + now.getMinutes();
		const today = todayISO();

		const config = getCalendarConfig();
		if (config.source !== 'none' && getSetting('last_daily_sync_date') !== today) {
			const syncAt = parseTimeToMin(config.syncTime) ?? 3 * 60 + 30;
			if (minutes >= syncAt) {
				setSetting('last_daily_sync_date', today);
				try {
					await syncCalendar({ source: 'auto' });
				} catch (error) {
					console.error('[daybook] automatic calendar sync failed:', error);
				}
			}
		}
	} finally {
		ticking = false;
	}
}

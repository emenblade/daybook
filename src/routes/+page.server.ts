import { currentMonth, monthRangeISO, todayISO } from '#lib/dates.ts';
import { sharedActions } from '#lib/server/actions.ts';
import * as repo from '#lib/server/repo.ts';
import { getCalendarConfig, getReminderSettings, getSetting } from '#lib/server/settings.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const today = todayISO();
	const reminder = getReminderSettings();
	const month = currentMonth();
	const { from, to } = monthRangeISO(month);
	const needsAttention = repo.appointmentsNeedingAttention(reminder.delayDays);
	const stale = repo.staleClients(reminder.staleDays, 10);

	return {
		today,
		month,
		appointments: repo.appointmentsForDay(today),
		otherToday: repo.otherEventsForDay(today, ['work']),
		needsAttention: needsAttention.slice(0, 5),
		needsAttentionCount: needsAttention.length,
		staleClients: stale.slice(0, 5),
		staleCount: stale.length,
		staleDays: reminder.staleDays,
		hours: repo.hoursSummary(from, to),
		lastSyncAt: getSetting('last_sync_at'),
		lastSyncStatus: getSetting('last_sync_status'),
		lastSyncError: getSetting('last_sync_error'),
		calendarSource: getCalendarConfig().source,
		delayDays: reminder.delayDays
	};
};

export const actions = sharedActions;

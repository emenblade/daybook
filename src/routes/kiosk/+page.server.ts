import { nowIso, todayISO } from '#lib/dates.ts';
import { sharedActions } from '#lib/server/actions.ts';
import * as repo from '#lib/server/repo.ts';
import { getReminderSettings, getSetting } from '#lib/server/settings.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const today = todayISO();
	const now = nowIso();
	const reminder = getReminderSettings();
	const appointments = repo
		.appointmentsForDay(today)
		.filter((appointment) => appointment.status !== 'canceled')
		.map((appointment) => ({ ...appointment, past: appointment.start_ts < now }));
	const needsAttention = repo.appointmentsNeedingAttention(reminder.delayDays);
	const stale = repo.staleClients(reminder.staleDays, 12);

	return {
		today,
		now,
		appointments,
		otherToday: repo.otherEventsForDay(today, ['work']),
		needsAttention: needsAttention.slice(0, 15),
		needsAttentionCount: needsAttention.length,
		staleClients: stale.slice(0, 6),
		staleCount: stale.length,
		delayDays: reminder.delayDays,
		staleDays: reminder.staleDays,
		reminderTime: reminder.time,
		lastSyncAt: getSetting('last_sync_at'),
		lastSyncStatus: getSetting('last_sync_status'),
		calendarSource: getSetting('last_sync_source') ?? 'none'
	};
};

export const actions = sharedActions;

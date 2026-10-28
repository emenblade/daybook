import { error } from '@sveltejs/kit';
import { daysSinceTs } from '#lib/dates.ts';
import { sharedActions } from '#lib/server/actions.ts';
import { appointmentsForClient, clientStats, getClient } from '#lib/server/repo.ts';
import { getReminderSettings } from '#lib/server/settings.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const id = Number(params.id);
	const client = getClient(id);
	if (!client) throw error(404, 'Client not found');

	const stats = clientStats(id);
	const daysSince = stats.lastSeenAt ? daysSinceTs(stats.lastSeenAt) : null;
	const staleDays = getReminderSettings().staleDays;
	const needsReview =
		client.status === 'active' &&
		daysSince !== null &&
		daysSince > staleDays &&
		stats.nextSessionAt === null;

	return {
		client,
		stats,
		daysSince,
		staleDays,
		needsReview,
		appointments: appointmentsForClient(id, 150)
	};
};

export const actions = sharedActions;

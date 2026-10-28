import { error } from '@sveltejs/kit';
import { daysSinceTs } from '#lib/dates.ts';
import { sharedActions } from '#lib/server/actions.ts';
import { appointmentsForClient, clientStats, getClient } from '#lib/server/repo.ts';
import { getReminderSettings } from '#lib/server/settings.ts';
import { dueTreatmentAction, treatmentPlanInfo } from '#lib/treatment.ts';
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
		daysSince >= staleDays &&
		stats.nextSessionAt === null;
	const planInfo = treatmentPlanInfo(
		client.treatment_plan_completed_at,
		client.treatment_plan_reviewed_at
	);
	const planDue = dueTreatmentAction(
		client.treatment_plan_completed_at,
		client.treatment_plan_reviewed_at
	);

	return {
		client,
		stats,
		daysSince,
		staleDays,
		needsReview,
		planInfo,
		planDue,
		planMissing: !client.treatment_plan_completed_at,
		planOverdue: !client.treatment_plan_completed_at && stats.totalSessions >= 3,
		appointments: appointmentsForClient(id, 150)
	};
};

export const actions = sharedActions;

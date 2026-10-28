import type { ClientStatus } from '#lib/types.ts';
import { sharedActions } from '#lib/server/actions.ts';
import { listClients, longTermReminders } from '#lib/server/repo.ts';
import { getReminderSettings } from '#lib/server/settings.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const search = url.searchParams.get('q')?.trim() ?? '';
	const statusParam = url.searchParams.get('status') ?? 'all';
	const allowed: (ClientStatus | 'all')[] = ['active', 'follow_up', 'discharged', 'all'];
	const status = allowed.includes(statusParam as ClientStatus | 'all')
		? (statusParam as ClientStatus | 'all')
		: 'all';
	const consent = url.searchParams.get('consent') === 'due' ? 'due' : 'all';
	const plan = url.searchParams.get('plan') === 'due' ? 'due' : 'all';
	const followup = url.searchParams.get('followup') === 'due' ? 'due' : 'all';

	let clients = listClients({ search: search || undefined, status, consent });
	const longTerm = longTermReminders(getReminderSettings().staleDays);
	const planById = new Map(longTerm.plans.map((item) => [item.client.id, item]));
	const followUpIds = new Set(longTerm.followUps.map((item) => item.client.id));
	if (plan === 'due') {
		clients = clients.filter((client) => planById.has(client.id));
	}
	if (followup === 'due') {
		clients = clients.filter((client) => followUpIds.has(client.id));
	}
	const filterLabel = [
		consent === 'due' ? 'consent' : null,
		plan === 'due' ? 'treatment plans' : null,
		followup === 'due' ? 'follow-up' : null
	]
		.filter(Boolean)
		.join(', ');

	return {
		clients: clients.map((client) => {
			const reminder = planById.get(client.id);
			return {
				...client,
				planDue: reminder?.overdue ?? false,
				planUpcoming: reminder ? !reminder.overdue : false
			};
		}),
		search,
		status,
		consent,
		plan,
		followup,
		filterLabel,
		today: new Date().toISOString()
	};
};

export const actions = sharedActions;

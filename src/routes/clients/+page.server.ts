import type { ClientStatus } from '#lib/types.ts';
import { sharedActions } from '#lib/server/actions.ts';
import { listClients } from '#lib/server/repo.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const search = url.searchParams.get('q')?.trim() ?? '';
	const statusParam = url.searchParams.get('status') ?? 'all';
	const allowed: (ClientStatus | 'all')[] = ['active', 'follow_up', 'discharged', 'all'];
	const status = allowed.includes(statusParam as ClientStatus | 'all')
		? (statusParam as ClientStatus | 'all')
		: 'all';

	return {
		clients: listClients({ search: search || undefined, status }),
		search,
		status,
		today: new Date().toISOString()
	};
};

export const actions = sharedActions;

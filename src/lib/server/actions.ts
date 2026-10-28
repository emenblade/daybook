import { fail, type Actions } from '@sveltejs/kit';
import type { ClientStatus, SessionStatus } from '#lib/types.ts';
import type { TreatmentActionKind } from '#lib/treatment.ts';
import * as repo from './repo.ts';
import { syncCalendar } from './sync.ts';

const SESSION_STATUSES: SessionStatus[] = ['scheduled', 'completed', 'no_show'];
const CLIENT_STATUSES: ClientStatus[] = ['active', 'follow_up', 'discharged'];
const TREATMENT_ACTIONS: TreatmentActionKind[] = ['complete', 'quarterly', 'annual'];

export const sharedActions: Actions = {
	setSessionStatus: async ({ request, url }) => {
		const form = await request.formData();
		const id = Number(form.get('id'));
		const rawStatus = String(form.get('status') ?? '');

		let next: SessionStatus;
		if (rawStatus === 'completed' || rawStatus === 'no_show') {
			next = rawStatus;
		} else if (rawStatus === 'scheduled' || rawStatus === 'clear') {
			next = 'scheduled';
		} else {
			return fail(400, { error: 'Invalid session status.' });
		}
		if (!id) return fail(400, { error: 'Missing session.' });

		const source = url.pathname.startsWith('/kiosk') ? 'kiosk' : 'admin';
		repo.setAppointmentStatus(id, next, source);
		return { success: true };
	},

	setClientConsent: async ({ request, url }) => {
		const form = await request.formData();
		const id = Number(form.get('id'));
		const raw = String(form.get('signed') ?? '');
		const signed = raw === '1' || raw === 'true' || raw === 'on';
		if (!id) return fail(400, { error: 'Missing client.' });
		const source = url.pathname.startsWith('/kiosk') ? 'kiosk' : 'admin';
		repo.setClientConsent(id, signed, source);
		return { success: true };
	},

	setTreatmentPlan: async ({ request }) => {
		const form = await request.formData();
		const id = Number(form.get('id'));
		const action = String(form.get('action') ?? '') as TreatmentActionKind;
		if (!id || !TREATMENT_ACTIONS.includes(action)) {
			return fail(400, { error: 'Invalid treatment plan action.' });
		}
		repo.setTreatmentPlan(id, action);
		return { success: true };
	},

	setClientStatus: async ({ request }) => {
		const form = await request.formData();
		const id = Number(form.get('id'));
		const status = String(form.get('status') ?? '') as ClientStatus;
		if (!id || !CLIENT_STATUSES.includes(status)) {
			return fail(400, { error: 'Invalid client status.' });
		}
		repo.setClientStatus(id, status);
		return { success: true };
	},

	syncNow: async () => {
		try {
			const result = await syncCalendar({ source: 'manual' });
			return { success: true, syncMessage: result.message };
		} catch (error) {
			return fail(400, { error: error instanceof Error ? error.message : String(error) });
		}
	},

	markClientReviewed: async ({ request }) => {
		const form = await request.formData();
		const id = Number(form.get('id'));
		const status = String(form.get('status') ?? '') as ClientStatus;
		if (!id || !CLIENT_STATUSES.includes(status)) {
			return fail(400, { error: 'Invalid client status.' });
		}
		repo.setClientStatus(id, status);
		return { success: true };
	}
};

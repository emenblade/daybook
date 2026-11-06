import { fail, redirect, type Actions } from '@sveltejs/kit';
import { parseISO, parseTimeToMin, todayISO } from '#lib/dates.ts';
import { modalityFor } from '#lib/session.ts';
import type { Modality } from '#lib/types.ts';
import type { ClientStatus, SessionStatus } from '#lib/types.ts';
import type { TreatmentActionKind } from '#lib/treatment.ts';
import * as repo from './repo.ts';
import { syncCalendar } from './sync.ts';

const SESSION_STATUSES: SessionStatus[] = ['scheduled', 'completed', 'no_show'];
const CLIENT_STATUSES: ClientStatus[] = ['active', 'follow_up', 'discharged'];
const TREATMENT_ACTIONS: TreatmentActionKind[] = ['complete', 'quarterly', 'annual'];
const MANUAL_STATUSES = ['completed', 'no_show', 'client_canceled'] as const;
const MODALITIES: Modality[] = ['in_person', 'remote', 'unknown'];

function dateToNoonIso(value: string): string | null {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
	const date = parseISO(value);
	date.setHours(12, 0, 0, 0);
	return date.toISOString();
}

export const sharedActions: Actions = {
	setSessionStatus: async ({ request, url }) => {
		const form = await request.formData();
		const id = Number(form.get('id'));
		const rawStatus = String(form.get('status') ?? '');

		let next: SessionStatus;
		let clientCanceled = false;
		if (rawStatus === 'completed' || rawStatus === 'no_show') {
			next = rawStatus;
		} else if (rawStatus === 'client_canceled') {
			next = 'no_show';
			clientCanceled = true;
		} else if (rawStatus === 'scheduled' || rawStatus === 'clear') {
			next = 'scheduled';
		} else {
			return fail(400, { error: 'Invalid session status.' });
		}
		if (!id) return fail(400, { error: 'Missing session.' });

		const source = url.pathname.startsWith('/kiosk') ? 'kiosk' : 'admin';
		repo.setAppointmentStatus(id, next, source, clientCanceled);
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

	setClientDates: async ({ request, locals }) => {
		const form = await request.formData();
		const id = Number(form.get('id'));
		if (!id) return fail(400, { datesError: 'Missing client.' });
		const consentRaw = String(form.get('consent_date') ?? '').trim();
		const planCompletedRaw = String(form.get('plan_completed_date') ?? '').trim();
		const planReviewedRaw = String(form.get('plan_reviewed_date') ?? '').trim();
		const today = todayISO();
		const values = [consentRaw, planCompletedRaw, planReviewedRaw].filter(Boolean);
		if (values.some((value) => !/^\d{4}-\d{2}-\d{2}$/.test(value) || value > today)) {
			return fail(400, { datesError: 'Use valid dates on or before today.' });
		}
		if (planReviewedRaw && !planCompletedRaw) {
			return fail(400, {
				datesError: 'Add a plan completion date before a plan review date.'
			});
		}
		const consentSignedAt = consentRaw ? dateToNoonIso(consentRaw) : null;
		const planCompletedAt = planCompletedRaw ? dateToNoonIso(planCompletedRaw) : null;
		const planReviewedAt = planReviewedRaw ? dateToNoonIso(planReviewedRaw) : null;
		repo.setClientHistoricalDates(id, { consentSignedAt, planCompletedAt, planReviewedAt });
		repo.logAudit(
			locals.user?.id ?? null,
			'set_client_dates',
			'client',
			id,
			JSON.stringify({ consentSignedAt, planCompletedAt, planReviewedAt })
		);
		return { datesSaved: true };
	},

	addHistoricalSession: async ({ request, locals }) => {
		const form = await request.formData();
		const clientId = Number(form.get('client_id'));
		if (!clientId) return fail(400, { sessionError: 'Missing client.' });
		const date = String(form.get('date') ?? '').trim();
		const time = String(form.get('time') ?? '').trim();
		const durationMin = Number(form.get('duration_min'));
		const service = String(form.get('service') ?? '').trim();
		const statusRaw = String(form.get('status') ?? '');
		const location = String(form.get('location') ?? '').trim() || null;
		const modalityRaw = String(form.get('modality') ?? 'auto');
		const provider = String(form.get('provider') ?? '').trim() || 'Manual';

		if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > todayISO()) {
			return fail(400, { sessionError: 'Use a valid date on or before today.' });
		}
		const startMin = parseTimeToMin(time);
		if (startMin === null) return fail(400, { sessionError: 'Use a valid time.' });
		if (!Number.isFinite(durationMin) || durationMin < 5 || durationMin > 480) {
			return fail(400, { sessionError: 'Duration must be 5–480 minutes.' });
		}
		if (!MANUAL_STATUSES.includes(statusRaw as (typeof MANUAL_STATUSES)[number])) {
			return fail(400, { sessionError: 'Choose a valid session status.' });
		}

		const start = parseISO(date);
		start.setHours(Math.floor(startMin / 60), startMin % 60, 0, 0);
		const end = new Date(start.getTime() + durationMin * 60000);
		const startTs = start.toISOString();
		if (repo.manualAppointmentExists(clientId, startTs)) {
			return fail(400, { sessionError: 'A manual entry already exists at that time.' });
		}
		const clientCanceled = statusRaw === 'client_canceled';
		const status = clientCanceled ? 'no_show' : (statusRaw as 'completed' | 'no_show');
		const modality =
			modalityRaw === 'auto'
				? modalityFor(service, location, service)
				: (modalityRaw as Modality);
		if (!MODALITIES.includes(modality)) {
			return fail(400, { sessionError: 'Choose a valid location type.' });
		}
		const id = repo.addHistoricalAppointment({
			clientId,
			startTs,
			endTs: end.toISOString(),
			durationMin,
			service,
			status,
			clientCanceled,
			location,
			modality,
			provider
		});
		repo.logAudit(
			locals.user?.id ?? null,
			'add_historical_session',
			'appointment',
			id,
			JSON.stringify({ clientId, startTs, durationMin, service, status, clientCanceled })
		);
		return { sessionAdded: true };
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

	deleteClient: async ({ request, locals }) => {
		const form = await request.formData();
		const id = Number(form.get('id'));
		if (!id) return fail(400, { error: 'Missing client.' });
		const removed = repo.deleteClientData(id);
		if (!removed) return fail(404, { error: 'Client not found.' });
		repo.logAudit(locals.user?.id ?? null, 'delete_client', 'client', id, null);
		throw redirect(303, '/clients');
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

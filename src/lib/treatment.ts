import { addDays, daysBetween, todayISO, tsToDate } from './dates.ts';

export const TREATMENT_REVIEW_DAYS = 90;
export const TREATMENT_REMAKE_DAYS = 365;
export const TREATMENT_UPCOMING_DAYS = 7;

export type TreatmentActionKind = 'complete' | 'quarterly' | 'annual';

export interface TreatmentAction {
	kind: TreatmentActionKind;
	label: string;
	shortLabel: string;
	dueOn: string | null;
}

export interface TreatmentPlanInfo {
	completedOn: string | null;
	reviewedOn: string | null;
	quarterlyDueOn: string | null;
	annualDueOn: string | null;
}

export function treatmentPlanInfo(
	completedAt: string | null,
	reviewedAt: string | null
): TreatmentPlanInfo {
	if (!completedAt) {
		return {
			completedOn: null,
			reviewedOn: null,
			quarterlyDueOn: null,
			annualDueOn: null
		};
	}
	const completedOn = tsToDate(completedAt);
	const reviewedOn = reviewedAt ? tsToDate(reviewedAt) : completedOn;
	return {
		completedOn,
		reviewedOn,
		quarterlyDueOn: addDays(reviewedOn, TREATMENT_REVIEW_DAYS),
		annualDueOn: addDays(completedOn, TREATMENT_REMAKE_DAYS)
	};
}

export function missingPlanAction(): TreatmentAction {
	return {
		kind: 'complete',
		label: 'Mark treatment plan complete',
		shortLabel: 'Treatment plan',
		dueOn: null
	};
}

export function quarterlyAction(dueOn: string): TreatmentAction {
	return {
		kind: 'quarterly',
		label: 'Quarterly review of treatment plan',
		shortLabel: 'Quarterly review',
		dueOn
	};
}

export function annualAction(dueOn: string): TreatmentAction {
	return {
		kind: 'annual',
		label: 'Annual treatment plan',
		shortLabel: 'Annual plan',
		dueOn
	};
}

/**
 * What treatment-plan paperwork belongs on this session card?
 * `priorCompletedSessions` is the number of completed sessions before this one,
 * so 2 means this appointment is the third session.
 */
export function treatmentActionForSession(opts: {
	completedAt: string | null;
	reviewedAt: string | null;
	priorCompletedSessions: number;
	sessionStartTs: string;
}): TreatmentAction | null {
	if (!opts.completedAt) {
		return opts.priorCompletedSessions >= 2 ? missingPlanAction() : null;
	}
	const info = treatmentPlanInfo(opts.completedAt, opts.reviewedAt);
	if (!info.quarterlyDueOn || !info.annualDueOn) return null;
	const sessionDate = tsToDate(opts.sessionStartTs);
	if (daysBetween(info.annualDueOn, sessionDate) >= -TREATMENT_UPCOMING_DAYS) {
		return annualAction(info.annualDueOn);
	}
	if (daysBetween(info.quarterlyDueOn, sessionDate) >= -TREATMENT_UPCOMING_DAYS) {
		return quarterlyAction(info.quarterlyDueOn);
	}
	return null;
}

/** The review/remake that is already due, used when no future session is booked. */
export function dueTreatmentAction(
	completedAt: string | null,
	reviewedAt: string | null,
	asOf: string = todayISO()
): TreatmentAction | null {
	const info = treatmentPlanInfo(completedAt, reviewedAt);
	if (info.annualDueOn && info.annualDueOn <= asOf) return annualAction(info.annualDueOn);
	if (info.quarterlyDueOn && info.quarterlyDueOn <= asOf) {
		return quarterlyAction(info.quarterlyDueOn);
	}
	return null;
}

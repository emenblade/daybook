import type { Modality } from './types.ts';

const REMOTE = /\b(video|virtual|zoom|teams|meet|online|telehealth|telephone|phone|webex)\b/i;
const IN_PERSON = /\b(in[- ]person|office|clinic|suite|room|onsite|on[- ]site)\b/i;

export function modalityFor(
	service: string | null | undefined,
	location: string | null | undefined,
	summary: string | null | undefined
): Modality {
	const text = [service, location, summary].filter(Boolean).join(' ');
	if (REMOTE.test(text)) return 'remote';
	if (IN_PERSON.test(text)) return 'in_person';
	if (location?.trim()) return 'in_person';
	return 'unknown';
}

export function modalityLabel(modality: Modality): string {
	if (modality === 'in_person') return 'In person';
	if (modality === 'remote') return 'Remote';
	return 'Location unknown';
}

export function modalityChipClass(modality: Modality): string {
	if (modality === 'in_person') {
		return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300';
	}
	if (modality === 'remote') {
		return 'bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-300';
	}
	return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300';
}

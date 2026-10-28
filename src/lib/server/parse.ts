import type { EventCategory, ParseRules, ParsedName, SessionType } from '#lib/types.ts';

/**
 * Defaults are tuned for the real Jane calendar feed:
 *   "First L. (In-Person FNIHB/IRS/Bigstone)"
 *   "First Middle L. (DBT Group (Online Through Zoom))"
 *   "First L. (Couples Counselling In Person - FNIHB/IRS/Bigstone)"
 *   "Break - Lunch" / "Break - Meeting ..." (non-client)
 *
 * The Sync screen can still override these at runtime.
 */
const LEGACY_SUMMARY_PATTERN =
	'^(?<client>[\\p{L}][\\p{L}\'’.-]*(?:\\s+[\\p{L}][\\p{L}\'’.-]*)*\\s+\\p{L}\\.)\\s*(?:\\((?<service>.*)\\))?\\s*$';

export const DEFAULT_PARSE_RULES: ParseRules = {
	summaryPatterns: [
		'^(?<client>[\\p{L}][\\p{L}\\p{N}\'’.#& -]*\\s+\\p{L}\\.)\\s*(?:\\((?<service>.*)\\))?\\s*$',
		'^Appointment with\\s+(?<client>[\\p{L}][\\p{L}\'’.-]*(?:\\s+[\\p{L}][\\p{L}\'’.-]*)+)$'
	],
	descriptionPatterns: [
		'^Client:\\s*(?<client>[^\\n]+)\\nService:\\s*(?<service>[^\\n]+)'
	],
	excludePatterns: ['^Break\\b'],
	defaultDurationMin: 60
};

export function isLegacyDefaultParseRules(stored: Partial<ParseRules>): boolean {
	return (
		Array.isArray(stored.summaryPatterns) &&
		stored.summaryPatterns.length === 1 &&
		stored.summaryPatterns[0] === LEGACY_SUMMARY_PATTERN &&
		Array.isArray(stored.descriptionPatterns) &&
		stored.descriptionPatterns.length === 0 &&
		Array.isArray(stored.excludePatterns) &&
		stored.excludePatterns.length === 1 &&
		stored.excludePatterns[0] === '^Break\\b' &&
		(stored.defaultDurationMin === undefined || stored.defaultDurationMin === 60)
	);
}

const MONTHS =
	'Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?';
const LEADING_DATE = new RegExp(
	`^(?:(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*\\.?,?\\s+)?(?:${MONTHS})\\.?\\s+\\d{1,2}(?:st|nd|rd|th)?(?:,\\s*\\d{4})?\\s+`,
	'i'
);

/** Jane sometimes prefixes the summary with the appointment date. */
function stripLeadingDate(summary: string): string {
	return summary
		.replace(LEADING_DATE, '')
		.replace(/^\d{4}-\d{2}-\d{2}\s+/, '')
		.trim();
}

const NAME_REJECTS = /^(cancelled|canceled|blocked|busy|free|lunch|break|hold)$/i;

export function normalizeName(name: string): string {
	return name
		.normalize('NFKD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, ' ')
		.trim()
		.replace(/\s+/g, ' ');
}

export function cleanClientName(raw: string | null | undefined): string | null {
	if (!raw) return null;
	let name = raw
		.replace(/\r/g, '')
		.replace(/\s+/g, ' ')
		.trim()
		.replace(/^["'“”‘’]+|["'“”‘’]+$/g, '')
		.replace(/[,;:]+$/g, '')
		.trim();
	if (!/\b[A-Z]\.$/.test(name)) name = name.replace(/\.+$/g, '').trim();
	if (!name || name.length < 2 || name.length > 80) return null;
	if (NAME_REJECTS.test(name)) return null;
	name = name
		.replace(/\s+[A-Za-z]{2,}#\d+\b/g, '')
		.replace(/\s+#\d+\b/g, '')
		.replace(/\s+[-–—]\s+\d+\s*(min|minutes|hr|hours?)\.?$/i, '')
		.replace(/\s+/g, ' ')
		.trim();
	return name || null;
}

export function cleanService(raw: string | null | undefined): string | null {
	if (!raw) return null;
	const service = raw
		.replace(/\r/g, '')
		.replace(/\s+/g, ' ')
		.trim()
		.replace(/^["'“”‘’]+|["'“”‘’]+$/g, '');
	return service || null;
}

export function normalizeService(service: string): string {
	return service
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, ' ')
		.trim()
		.replace(/\s+/g, ' ');
}

export function sessionTypeForService(service: string): SessionType {
	if (/\bcouples?\b/i.test(service)) return 'couples';
	if (/\bfamily\b/i.test(service)) return 'family';
	if (/\b(dbt|group)\b/i.test(service)) return 'group';
	return 'individual';
}

/**
 * The feed prefixes every non-client block with "Break -".
 * Routine breaks/lunch are hidden from the app; work/personal/vacation blocks
 * can be shown as informational, never as actionable sessions.
 */
export function classifyNonClient(summary: string): EventCategory {
	const body = summary.replace(/^Break\s*-\s*/i, '').trim().toLowerCase();
	if (
		!body ||
		/^(break|lunch|blocked|unavailable|do not book|hold)$/.test(body) ||
		/^(break|lunch|blocked|unavailable|do not book|hold)\b/.test(body)
	) {
		return 'break';
	}
	if (/vacation|holiday|time off|pto|^leave\b/.test(body)) return 'vacation';
	if (
		/personal|appt|appointment|ortho|airport|drive|pick ?up|pickup|drop ?off|dropoff|yoga|gym|school|daycare|childcare|dr\b|doctor|dentist|physio/.test(
			body
		)
	) {
		return 'personal';
	}
	if (
		/meeting|call|consult|case consult|prep|treatment|report|webinar|training|admin|supervision|staff|team|paperwork|notes/.test(
			body
		)
	) {
		return 'work';
	}
	return 'other';
}

function compile(pattern: string): RegExp | null {
	try {
		return new RegExp(pattern, 'iu');
	} catch {
		return null;
	}
}

export function extractClient(
	summary: string,
	description: string,
	rules: ParseRules
): ParsedName {
	const combined = `${summary}\n${description}`;

	for (const pattern of rules.excludePatterns) {
		const re = compile(pattern);
		if (!re) continue;
		if (re.test(combined)) {
			return {
				name: null,
				service: null,
				excluded: true,
				reason: `Matched exclude rule /${pattern}/`,
				sourceField: null
			};
		}
	}

	const fields: [('summary' | 'description'), string[], string][] = [
		['summary', rules.summaryPatterns, stripLeadingDate(summary)],
		['description', rules.descriptionPatterns, description]
	];

	for (const [field, patterns, text] of fields) {
		if (!text) continue;
		for (const pattern of patterns) {
			if (!pattern.includes('(?<client>')) continue;
			const re = compile(pattern);
			if (!re) continue;
			const match = re.exec(text);
			const name = cleanClientName(match?.groups?.client);
			if (name) {
				return {
					name,
					service: cleanService(match?.groups?.service),
					excluded: false,
					reason: null,
					sourceField: field
				};
			}
		}
	}

	return {
		name: null,
		service: null,
		excluded: false,
		reason: 'No client-name pattern matched',
		sourceField: null
	};
}

export function validateRules(
	input: unknown
): { ok: true; rules: ParseRules } | { ok: false; error: string } {
	if (!input || typeof input !== 'object') {
		return { ok: false, error: 'Rules must be a JSON object.' };
	}
	const obj = input as Record<string, unknown>;
	const arrays = ['summaryPatterns', 'descriptionPatterns', 'excludePatterns'] as const;
	const rules: ParseRules = {
		summaryPatterns: [],
		descriptionPatterns: [],
		excludePatterns: [],
		defaultDurationMin: 60
	};
	for (const key of arrays) {
		const value = obj[key];
		if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
			return { ok: false, error: `"${key}" must be an array of regex strings.` };
		}
		for (const pattern of value) {
			try {
				new RegExp(pattern as string, 'iu');
			} catch {
				return { ok: false, error: `Invalid regex in "${key}": ${pattern}` };
			}
		}
		rules[key] = value as string[];
	}
	if (typeof obj.defaultDurationMin === 'number' && obj.defaultDurationMin > 0) {
		rules.defaultDurationMin = Math.min(480, Math.round(obj.defaultDurationMin));
	}
	if (!rules.summaryPatterns.some((p) => p.includes('(?<client>'))) {
		return { ok: false, error: 'At least one summary pattern must contain a (?<client>...) group.' };
	}
	return { ok: true, rules };
}

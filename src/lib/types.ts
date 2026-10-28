import type { TreatmentAction } from './treatment.ts';

export type SessionStatus = 'scheduled' | 'completed' | 'no_show' | 'canceled';
export type ClientStatus = 'active' | 'follow_up' | 'discharged';
export type CalendarSource = 'ics' | 'caldav';
export type SessionType = 'individual' | 'couples' | 'family' | 'group';
export type EventKind = 'client' | 'other' | 'duplicate';
export type Modality = 'in_person' | 'remote' | 'unknown';
export type EventCategory =
	| 'session'
	| 'break'
	| 'work'
	| 'personal'
	| 'vacation'
	| 'other'
	| 'duplicate';

export interface User {
	id: number;
	name: string;
	color: string;
}

export interface Participant {
	id: number;
	name: string;
	consent_signed_at: string | null;
	treatment_plan_completed_at: string | null;
	treatment_plan_reviewed_at: string | null;
	prior_completed_sessions: number;
}

export interface Client {
	id: number;
	name: string;
	normalized: string;
	status: ClientStatus;
	consent_signed_at: string | null;
	consent_signed_source: string | null;
	treatment_plan_completed_at: string | null;
	treatment_plan_reviewed_at: string | null;
	is_demo: number;
	created_at: string;
	updated_at: string;
}

export interface Appointment {
	id: number;
	group_key: string;
	start_ts: string;
	end_ts: string;
	duration_min: number;
	title: string;
	service: string;
	session_type: SessionType;
	status: SessionStatus;
	confirmed_at: string | null;
	confirmed_source: string | null;
	location: string | null;
	modality: Modality;
	provider: string | null;
	is_demo: number;
	participants: Participant[];
}

export interface ClientSummary extends Client {
	last_seen_at: string | null;
	total_sessions: number;
	total_minutes: number;
	next_session_at: string | null;
	days_since_seen: number | null;
	providers: string | null;
}

export interface CalendarEvent {
	id: number;
	uid: string;
	source: string;
	calendar_name: string | null;
	summary: string | null;
	description: string | null;
	location: string | null;
	start_ts: string;
	end_ts: string;
	all_day: number;
	recurring: number;
	event_kind: EventKind;
	category: EventCategory;
	service: string | null;
	parsed_client: string | null;
	group_key: string | null;
	removed: number;
	last_seen_at: string;
}

export interface OtherEvent {
	id: number;
	summary: string;
	start_ts: string;
	end_ts: string;
	category: EventCategory;
	location: string | null;
}

export interface SyncRun {
	id: number;
	source: string;
	started_at: string;
	finished_at: string | null;
	ok: number | null;
	message: string | null;
	events_seen: number;
	appointments_created: number;
	appointments_updated: number;
}

export interface ParseRules {
	summaryPatterns: string[];
	descriptionPatterns: string[];
	excludePatterns: string[];
	defaultDurationMin: number;
}

export interface CalendarConfig {
	source: 'none' | CalendarSource;
	icsUrl: string;
	caldavServer: string;
	caldavUsername: string;
	caldavPassword: string;
	caldavCalendar: string;
	providerName: string;
	syncTime: string;
}

export interface ReminderSettings {
	delayDays: number;
	time: string;
	staleDays: number;
}

export interface FollowUpReminder {
	kind: 'follow_up';
	client: ClientSummary;
}

export interface TreatmentPlanReminder {
	kind: 'treatment_plan';
	client: ClientSummary;
	action: TreatmentAction;
	dueOn: string | null;
	sessionAt: string | null;
	overdue: boolean;
}

export interface ParsedName {
	name: string | null;
	service: string | null;
	excluded: boolean;
	reason: string | null;
	sourceField: 'summary' | 'description' | null;
}

export interface DayCell {
	date: string;
	total: number;
	completed: number;
	no_show: number;
	scheduled: number;
	needsAttention: number;
	canceled: number;
	other: number;
}

export interface HoursSummary {
	totalMinutes: number;
	completedCount: number;
	noShowCount: number;
	clientCount: number;
}

export interface TypeHours {
	type: SessionType;
	minutes: number;
	count: number;
}

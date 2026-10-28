import type { Participant, SessionType } from './types.ts';

export function participantNames(participants: Participant[]): string {
	return participants.map((participant) => participant.name).join(', ');
}

export function typeLabel(type: SessionType): string {
	switch (type) {
		case 'couples':
			return 'Couples';
		case 'family':
			return 'Family';
		case 'group':
			return 'Group';
		default:
			return 'Individual';
	}
}

export function typeLabelPlural(type: SessionType): string {
	switch (type) {
		case 'couples':
			return 'Couples';
		case 'family':
			return 'Family';
		case 'group':
			return 'Group';
		default:
			return 'Individual';
	}
}

export function normalizeUsername(value: string): string {
	return value.trim().toLowerCase();
}

export function isValidUsername(value: string): boolean {
	return /^[a-z0-9._-]{3,32}$/.test(normalizeUsername(value));
}

export function usernameFromName(name: string): string {
	return (
		name
			.toLowerCase()
			.replace(/[^a-z0-9._-]+/g, '.')
			.replace(/^[._-]+|[._-]+$/g, '')
			.slice(0, 32) || 'user'
	);
}

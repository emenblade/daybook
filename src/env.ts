import { defineEnvVars } from '@sveltejs/kit/env';

export const variables = defineEnvVars({
	DATABASE_PATH: {
		description: 'Path to the SQLite database file',
		schema: (value) => value ?? 'data/daybook.db'
	}
});

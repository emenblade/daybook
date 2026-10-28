import { fail, redirect } from '@sveltejs/kit';
import { createSessionCookie, setUserCredentials, usernameTaken } from '#lib/server/auth.ts';
import { isValidUsername, normalizeUsername } from '#lib/username.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) throw redirect(303, '/login');
	if (!locals.user.must_change_credentials) throw redirect(303, '/');
	return { name: locals.user.name };
};

export const actions: Actions = {
	default: async ({ request, locals, cookies, url }) => {
		if (!locals.user) return fail(401, { error: 'Not signed in.' });
		if (!locals.user.must_change_credentials) throw redirect(303, '/');

		const form = await request.formData();
		const username = String(form.get('username') ?? '').trim();
		const password = String(form.get('password') ?? '');
		const confirm = String(form.get('confirm_password') ?? '');

		if (!isValidUsername(username)) {
			return fail(400, {
				error: 'Username must be 3–32 characters: letters, numbers, dots, dashes, underscores.'
			});
		}
		if (usernameTaken(username, locals.user.id)) {
			return fail(400, { error: 'That username is already taken.' });
		}
		if (password.length < 12 || password.length > 200) {
			return fail(400, { error: 'Password must be 12–200 characters.' });
		}
		if (password !== confirm) {
			return fail(400, { error: 'Passwords do not match.' });
		}
		const bootstrapUsername = normalizeUsername(process.env.DAYBOOK_SETUP_USERNAME || 'admin');
		const bootstrapPassword = process.env.DAYBOOK_SETUP_PASSWORD || 'daybook-setup';
		if (normalizeUsername(username) === bootstrapUsername && password === bootstrapPassword) {
			return fail(400, {
				error: 'Choose a different username and password than the first-run setup credentials.'
			});
		}

		const user = setUserCredentials(locals.user.id, username, password);
		createSessionCookie(cookies, user, url.protocol === 'https:');
		throw redirect(303, '/');
	}
};

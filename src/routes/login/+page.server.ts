import { fail, redirect } from '@sveltejs/kit';
import {
	authenticate,
	clearLoginFailures,
	createSessionCookie,
	loginLockSeconds,
	recordLoginFailure
} from '#lib/server/auth.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (locals.user) {
		throw redirect(303, locals.user.must_change_credentials ? '/setup' : '/');
	}
	const next = url.searchParams.get('next') ?? '/';
	return {
		next: next.startsWith('/') ? next : '/'
	};
};

export const actions: Actions = {
	default: async ({ request, cookies, url, getClientAddress }) => {
		const form = await request.formData();
		const username = String(form.get('username') ?? '');
		const password = String(form.get('password') ?? '');
		const key = getClientAddress();
		const locked = loginLockSeconds(key);
		if (locked > 0) {
			return fail(429, {
				error: `Too many attempts. Try again in ${Math.max(1, Math.ceil(locked / 60))} minute(s).`
			});
		}

		const user = authenticate(username, password);
		if (!user) {
			recordLoginFailure(key);
			return fail(400, { error: 'Invalid username or password.' });
		}

		clearLoginFailures(key);
		createSessionCookie(cookies, user, url.protocol === 'https:');
		const next = String(form.get('next') ?? '/');
		throw redirect(303, user.must_change_credentials ? '/setup' : next.startsWith('/') ? next : '/');
	}
};

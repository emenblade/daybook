import { fail, redirect } from '@sveltejs/kit';
import { authenticate, createSessionCookie } from '#lib/server/auth.ts';
import { getPrimaryUser } from '#lib/server/repo.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (locals.user) throw redirect(303, '/');
	const user = getPrimaryUser();
	const next = url.searchParams.get('next') ?? '/';
	return {
		userName: user?.name ?? 'Daybook',
		next: next.startsWith('/') ? next : '/'
	};
};

export const actions: Actions = {
	default: async ({ request, cookies }) => {
		const form = await request.formData();
		const pin = String(form.get('pin') ?? '');
		const user = getPrimaryUser();
		if (!user || !authenticate(user.id, pin)) {
			return fail(400, { error: 'Wrong PIN. Try again.' });
		}
		createSessionCookie(cookies, user.id);
		const next = String(form.get('next') ?? '/');
		throw redirect(303, next.startsWith('/') ? next : '/');
	}
};

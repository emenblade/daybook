<script lang="ts">
	import Logo from '#lib/components/Logo.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<div
	class="flex min-h-dvh flex-col items-center justify-center bg-slate-100 px-5 py-10 text-slate-900 dark:bg-slate-950 dark:text-slate-100"
>
	<div class="w-full max-w-sm">
		<div class="mb-8 text-center">
			<div class="mb-2 flex justify-center">
				<Logo class="h-12 w-12 text-teal-600 dark:text-teal-400" />
			</div>
			<h1 class="text-2xl font-bold tracking-tight">Daybook</h1>
			<p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
				Session notes, billable hours &amp; client follow-ups
			</p>
		</div>

		<form method="POST" class="card space-y-4 p-4">
			<input type="hidden" name="next" value={data.next} />
			<div>
				<label class="label" for="username">Username</label>
				<input
					id="username"
					class="input"
					type="text"
					name="username"
					autocomplete="username"
					autocapitalize="none"
					spellcheck="false"
					required
				/>
			</div>
			<div>
				<label class="label" for="password">Password</label>
				<input
					id="password"
					class="input"
					type="password"
					name="password"
					autocomplete="current-password"
					required
				/>
			</div>

			{#if form?.error}
				<p class="text-sm font-medium text-rose-600 dark:text-rose-400">{form.error}</p>
			{/if}

			<button class="btn-primary w-full" type="submit">Sign in</button>
		</form>
	</div>
</div>

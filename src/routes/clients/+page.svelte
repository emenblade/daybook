<script lang="ts">
	import ClientStatusPill from '#lib/components/ClientStatusPill.svelte';
	import ConsentCheck from '#lib/components/ConsentCheck.svelte';
	import { fmtTsDate, relativeDaysText } from '#lib/dates.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<header class="mb-4">
	<p class="text-xs font-semibold uppercase tracking-wide text-slate-400">Clients</p>
	<h1 class="text-xl font-bold">
		{data.clients.length} client{data.clients.length === 1 ? '' : 's'}{#if data.filterLabel}{' '}<span
				class="text-sm font-normal text-slate-400">· {data.filterLabel}</span
			>{/if}
	</h1>
</header>

<form method="GET" class="card mb-4 space-y-2 p-3">
	<div class="grid grid-cols-[1fr_auto] gap-2">
		<input
			class="input"
			type="search"
			name="q"
			value={data.search}
			placeholder="Search clients"
			aria-label="Search clients"
		/>
		<select class="input" name="status" aria-label="Client status">
			<option value="all" selected={data.status === 'all'}>Everyone</option>
			<option value="active" selected={data.status === 'active'}>Active</option>
			<option value="follow_up" selected={data.status === 'follow_up'}>Follow up</option>
			<option value="discharged" selected={data.status === 'discharged'}>Discharged</option>
		</select>
	</div>
	<label class="flex items-center gap-2 text-sm font-medium">
		<input
			type="checkbox"
			name="consent"
			value="due"
			checked={data.consent === 'due'}
			class="h-4 w-4 rounded border-slate-300"
		/>
		Consent forms due
	</label>
	<label class="flex items-center gap-2 text-sm font-medium">
		<input
			type="checkbox"
			name="plan"
			value="due"
			checked={data.plan === 'due'}
			class="h-4 w-4 rounded border-slate-300"
		/>
		Treatment plans due
	</label>
	<label class="flex items-center gap-2 text-sm font-medium">
		<input
			type="checkbox"
			name="followup"
			value="due"
			checked={data.followup === 'due'}
			class="h-4 w-4 rounded border-slate-300"
		/>
		Follow up due
	</label>
	<div class="flex gap-2">
		<button class="btn-primary flex-1 py-2" type="submit">Filter</button>
		<a class="btn-secondary px-4 py-2" href="/clients">Clear</a>
	</div>
</form>

<ul class="space-y-2">
	{#each data.clients as client (client.id)}
		<li class="card flex items-stretch p-0">
			<a
				href="/clients/{client.id}"
				class="flex min-w-0 flex-1 items-center justify-between gap-3 p-3 transition active:scale-[0.99]"
			>
				<div class="min-w-0">
					<p class="flex flex-wrap items-center gap-2 truncate font-semibold">
						{client.name}
						<ClientStatusPill status={client.status} />
						{#if client.planDue}
							<span
								class="pill bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300"
								>Plan due</span
							>
						{:else if client.planUpcoming}
							<span
								class="pill bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300"
								>Plan soon</span
							>
						{/if}
					</p>
					<p class="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
						{#if client.last_seen_at}
							Last seen {fmtTsDate(client.last_seen_at)} · {relativeDaysText(
								client.days_since_seen ?? 0
							)}
						{:else}
							No completed sessions yet
						{/if}
						· {client.total_sessions} session{client.total_sessions === 1 ? '' : 's'}
					</p>
					{#if client.next_session_at}
						<p class="mt-0.5 text-xs font-medium text-sky-600 dark:text-sky-400">
							Next: {fmtTsDate(client.next_session_at)}
						</p>
					{/if}
					{#if client.providers}
						<p class="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">
							{client.providers.includes(',') ? 'Providers' : 'Provider'}:
							{client.providers.replaceAll(',', ', ')}
						</p>
					{/if}
				</div>
				<svg
					class="h-5 w-5 shrink-0 text-slate-300 dark:text-slate-600"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<path d="m9 6 6 6-6 6" />
				</svg>
			</a>
			<div
				class="flex shrink-0 items-center border-l border-slate-100 px-2.5 dark:border-slate-800"
			>
				{#if client.consent_signed_at}
					<span
						class="pill bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300"
						title="Consent signed"
						>Consent ✓</span
					>
				{:else}
					<ConsentCheck participant={client} compact label="Consent" />
				{/if}
			</div>
		</li>
	{:else}
		<li class="card p-4 text-center text-sm text-slate-400 dark:text-slate-500">
			No clients match that filter.
		</li>
	{/each}
</ul>

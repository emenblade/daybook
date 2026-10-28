<script lang="ts">
	import ClientStatusPill from '#lib/components/ClientStatusPill.svelte';
	import { fmtTsDate, relativeDaysText } from '#lib/dates.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<header class="mb-4">
	<p class="text-xs font-semibold uppercase tracking-wide text-slate-400">Clients</p>
	<h1 class="text-xl font-bold">{data.clients.length} client{data.clients.length === 1 ? '' : 's'}</h1>
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
	<div class="flex gap-2">
		<button class="btn-primary flex-1 py-2" type="submit">Filter</button>
		<a class="btn-secondary px-4 py-2" href="/clients">Clear</a>
	</div>
</form>

<ul class="space-y-2">
	{#each data.clients as client (client.id)}
		<li>
			<a
				href="/clients/{client.id}"
				class="card flex items-center justify-between gap-3 p-3 transition active:scale-[0.99]"
			>
				<div class="min-w-0">
					<p class="flex items-center gap-2 truncate font-semibold">
						{client.name}
						<ClientStatusPill status={client.status} />
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
		</li>
	{:else}
		<li class="card p-4 text-center text-sm text-slate-400 dark:text-slate-500">
			No clients match that filter.
		</li>
	{/each}
</ul>

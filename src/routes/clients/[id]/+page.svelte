<script lang="ts">
	import { enhance } from '$app/forms';
	import AppointmentRow from '#lib/components/AppointmentRow.svelte';
	import ClientStatusPill from '#lib/components/ClientStatusPill.svelte';
	import { fmtHours, fmtTsDate } from '#lib/dates.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<header class="mb-4">
	<a href="/clients" class="text-xs font-semibold text-sky-600 dark:text-sky-400"
		>&larr; All clients</a
	>
	<div class="mt-1 flex items-start justify-between gap-2">
		<h1 class="text-xl font-bold">{data.client.name}</h1>
		<ClientStatusPill status={data.client.status} />
	</div>
</header>

{#if data.needsReview}
	<div
		class="card mb-4 border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
	>
		Not seen in {data.daysSince} days (threshold: {data.staleDays}). Discharge this client or mark
		them for follow-up.
	</div>
{/if}

<section class="card mb-4 p-3">
	<div class="flex flex-wrap gap-1.5">
		<form method="POST" action="?/setClientStatus" use:enhance>
			<input type="hidden" name="id" value={data.client.id} />
			<input type="hidden" name="status" value="active" />
			<button class="chip {data.client.status === 'active' ? 'chip-emerald' : 'chip-slate'}">
				Active
			</button>
		</form>
		<form method="POST" action="?/setClientStatus" use:enhance>
			<input type="hidden" name="id" value={data.client.id} />
			<input type="hidden" name="status" value="follow_up" />
			<button class="chip {data.client.status === 'follow_up' ? 'chip-amber' : 'chip-slate'}">
				Follow up
			</button>
		</form>
		<form
			method="POST"
			action="?/setClientStatus"
			use:enhance={({ cancel }) => {
				if (!window.confirm(`Mark ${data.client.name} as discharged?`)) cancel();
			}}
		>
			<input type="hidden" name="id" value={data.client.id} />
			<input type="hidden" name="status" value="discharged" />
			<button class="chip {data.client.status === 'discharged' ? 'chip-rose' : 'chip-slate'}">
				Discharged
			</button>
		</form>
	</div>
</section>

<div class="grid grid-cols-2 gap-2">
	<div class="card p-3">
		<p class="text-2xl font-bold leading-none">{data.stats.totalSessions}</p>
		<p class="mt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
			completed appointments
		</p>
	</div>
	<div class="card p-3">
		<p class="text-2xl font-bold leading-none">{fmtHours(data.stats.totalMinutes)}</p>
		<p class="mt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
			hours in sessions
		</p>
	</div>
	<div class="card p-3">
		<p class="text-2xl font-bold leading-none">
			{data.stats.avgIntervalDays !== null ? `${data.stats.avgIntervalDays}d` : '—'}
		</p>
		<p class="mt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
			average interval
		</p>
	</div>
	<div class="card p-3">
		<p class="text-2xl font-bold leading-none">{data.stats.noShows}</p>
		<p class="mt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
			no-shows
		</p>
	</div>
</div>

<section class="card mt-3 space-y-1 p-3 text-sm">
	<p class="flex justify-between gap-2">
		<span class="text-slate-500 dark:text-slate-400">Last seen</span>
		<span class="font-semibold"
			>{data.stats.lastSeenAt ? fmtTsDate(data.stats.lastSeenAt) : 'Never'}</span
		>
	</p>
	<p class="flex justify-between gap-2">
		<span class="text-slate-500 dark:text-slate-400">Next booked</span>
		<span class="font-semibold"
			>{data.stats.nextSessionAt ? fmtTsDate(data.stats.nextSessionAt) : 'Nothing booked'}</span
		>
	</p>
</section>

<section class="mt-5">
	<h2 class="mb-2 font-bold">Appointment history</h2>
	<ul class="space-y-2">
		{#each data.appointments as appointment (appointment.id)}
			<AppointmentRow {appointment} showDate />
		{:else}
			<li class="card p-4 text-center text-sm text-slate-400 dark:text-slate-500">
				No appointments recorded yet.
			</li>
		{/each}
	</ul>
</section>

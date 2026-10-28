<script lang="ts">
	import AppointmentRow from '#lib/components/AppointmentRow.svelte';
	import OtherEvents from '#lib/components/OtherEvents.svelte';
	import { fmtDateLong } from '#lib/dates.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<header class="mb-4">
	<div class="flex items-start justify-between gap-2">
		<div>
			<p class="text-xs font-semibold uppercase tracking-wide text-slate-400">Day</p>
			<h1 class="text-xl font-bold">{fmtDateLong(data.date)}</h1>
		</div>
		{#if data.date !== data.today}
			<a class="chip chip-sky" href="/day/today">Today</a>
		{/if}
	</div>
	<div class="mt-2 flex gap-1.5">
		<a class="chip chip-slate" href="/day/{data.prev}">&larr;</a>
		<a class="chip chip-slate" href="/calendar">Month</a>
		<a class="chip chip-slate" href="/day/{data.next}">&rarr;</a>
	</div>
</header>

<ul class="space-y-2">
	{#each data.appointments as appointment (appointment.id)}
		<AppointmentRow {appointment} />
	{:else}
		<li class="card p-4 text-center text-sm text-slate-400 dark:text-slate-500">
			No client appointments on this day.
		</li>
	{/each}
</ul>

{#if data.other.length > 0}
	<section class="card mt-3 p-3">
		<OtherEvents events={data.other} />
	</section>
{/if}

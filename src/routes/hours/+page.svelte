<script lang="ts">
	import { fmtHours } from '#lib/dates.ts';
	import { typeLabel } from '#lib/format.ts';
	import { modalityLabel } from '#lib/session.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<header class="mb-4 flex items-center justify-between">
	<div>
		<p class="text-xs font-semibold uppercase tracking-wide text-slate-400">Hours</p>
		<h1 class="text-xl font-bold">{data.label}</h1>
	</div>
	<div class="flex items-center gap-1.5">
		<a class="chip chip-slate" href="?m={data.prev}" aria-label="Previous month">&larr;</a>
		<a class="chip chip-sky" href="/hours">This month</a>
		<a class="chip chip-slate" href="?m={data.next}" aria-label="Next month">&rarr;</a>
	</div>
</header>

<div class="grid grid-cols-2 gap-2">
	<div class="card p-3">
		<p class="text-2xl font-bold leading-none">{fmtHours(data.weekSummary.totalMinutes)}</p>
		<p class="mt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
			hours this week
		</p>
	</div>
	<div class="card p-3">
		<p class="text-2xl font-bold leading-none">{fmtHours(data.summary.totalMinutes)}</p>
		<p class="mt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
			hours this month
		</p>
	</div>
	<div class="card p-3">
		<p class="text-2xl font-bold leading-none">{fmtHours(data.yearSummary.totalMinutes)}</p>
		<p class="mt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
			hours in {data.year}
		</p>
	</div>
	<div class="card p-3">
		<p class="text-2xl font-bold leading-none">{data.summary.noShowCount}</p>
		<p class="mt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
			no-shows this month
		</p>
	</div>
</div>

<p class="mt-2 text-xs text-slate-500 dark:text-slate-400">
	{data.summary.completedCount} completed appointment{data.summary.completedCount === 1
		? ''
		: 's'} this month. Group and couples sessions count once.
</p>

<section class="card mt-4 overflow-hidden">
	<h2 class="border-b border-slate-100 px-3 py-2 text-sm font-bold dark:border-slate-800">
		By session type ({data.label})
	</h2>
	<table class="w-full text-sm">
		<tbody>
			{#each data.typeRows as row (row.type)}
				<tr class="border-b border-slate-50 last:border-0 dark:border-slate-800/60">
					<td class="px-3 py-2">
						{typeLabel(row.type)}{row.type === 'group' ? ' session' : ''}
					</td>
					<td class="px-3 py-2 text-right text-xs text-slate-500 dark:text-slate-400">
						{row.count} appointment{row.count === 1 ? '' : 's'}
					</td>
					<td class="px-3 py-2 text-right font-semibold">{fmtHours(row.minutes)}h</td>
				</tr>
			{/each}
		</tbody>
	</table>
</section>

<section class="card mt-4 overflow-hidden">
	<h2 class="border-b border-slate-100 px-3 py-2 text-sm font-bold dark:border-slate-800">
		By modality ({data.label})
	</h2>
	<table class="w-full text-sm">
		<tbody>
			{#each data.modalityRows as row (row.modality)}
				<tr class="border-b border-slate-50 last:border-0 dark:border-slate-800/60">
					<td class="px-3 py-2">{modalityLabel(row.modality)}</td>
					<td class="px-3 py-2 text-right text-xs text-slate-500 dark:text-slate-400">
						{row.count} appointment{row.count === 1 ? '' : 's'}
					</td>
					<td class="px-3 py-2 text-right font-semibold">{fmtHours(row.minutes)}h</td>
				</tr>
			{/each}
		</tbody>
	</table>
</section>

{#if data.providerRows.length > 0}
	<section class="card mt-4 overflow-hidden">
		<h2 class="border-b border-slate-100 px-3 py-2 text-sm font-bold dark:border-slate-800">
			By provider ({data.label})
		</h2>
		<table class="w-full text-sm">
			<tbody>
				{#each data.providerRows as row (row.provider)}
					<tr class="border-b border-slate-50 last:border-0 dark:border-slate-800/60">
						<td class="px-3 py-2">{row.provider}</td>
						<td class="px-3 py-2 text-right text-xs text-slate-500 dark:text-slate-400">
							{row.count} appointment{row.count === 1 ? '' : 's'}
						</td>
						<td class="px-3 py-2 text-right font-semibold">{fmtHours(row.minutes)}h</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</section>
{/if}

<section class="card mt-4 overflow-hidden">
	<h2 class="border-b border-slate-100 px-3 py-2 text-sm font-bold dark:border-slate-800">
		Months in {data.year}
	</h2>
	<table class="w-full text-sm">
		<tbody>
			{#each data.months as month (month.month)}
				<tr
					class="border-b border-slate-50 last:border-0 dark:border-slate-800/60 {month.current
						? 'bg-sky-50/60 dark:bg-sky-950/20'
						: ''}"
				>
					<td class="px-3 py-1.5 text-xs">
						<a
							class="font-medium {month.current
								? 'text-sky-700 dark:text-sky-300'
								: 'text-slate-600 dark:text-slate-300'}"
							href="?m={month.month}">{month.label}</a
						>
					</td>
					<td class="px-3 py-1.5 text-right text-[11px] text-slate-400">
						{month.count} appointment{month.count === 1 ? '' : 's'}
					</td>
					<td class="px-3 py-1.5 text-right font-semibold">
						{month.hours > 0 ? `${fmtHours(month.hours)}h` : '—'}
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</section>

<section class="card mt-4 overflow-hidden">
	<h2 class="border-b border-slate-100 px-3 py-2 text-sm font-bold dark:border-slate-800">
		Last 8 weeks
	</h2>
	<table class="w-full text-sm">
		<tbody>
			{#each data.weeks as week (week.start)}
				<tr
					class="border-b border-slate-50 last:border-0 dark:border-slate-800/60 {week.current
						? 'bg-sky-50/60 dark:bg-sky-950/20'
						: ''}"
				>
					<td class="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
						{week.label}{#if week.current}<span
								class="ml-1 font-semibold text-sky-600 dark:text-sky-400">now</span
							>{/if}
					</td>
					<td class="px-3 py-2 text-right font-semibold">
						{week.hours.totalMinutes > 0 ? `${fmtHours(week.hours.totalMinutes)}h` : '—'}
					</td>
					<td class="px-3 py-2 text-right text-xs text-slate-400">
						{week.hours.completedCount} appointment{week.hours.completedCount === 1 ? '' : 's'}
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</section>

<div class="mt-4 flex flex-wrap gap-2">
	<a
		class="chip chip-slate"
		href="/api/export?from={encodeURIComponent(data.exportFrom)}&to={encodeURIComponent(
			data.exportTo
		)}">Download CSV (this month)</a
	>
	<a
		class="chip chip-slate"
		href="/api/export?from={encodeURIComponent(data.yearFrom)}&to={encodeURIComponent(
			data.yearTo
		)}">Download CSV ({data.year})</a
	>
</div>

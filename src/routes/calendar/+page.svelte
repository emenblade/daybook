<script lang="ts">
	import type { DayCell } from '#lib/types.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

	function cellFor(date: string): DayCell | undefined {
		return data.cells[date];
	}

	function cellClass(date: string): string {
		const cell = cellFor(date);
		const inMonth = date.startsWith(data.month);
		if (!cell) {
			return inMonth
				? 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
				: 'border-slate-100 bg-slate-50 dark:border-slate-800/50 dark:bg-slate-900/40';
		}
		if (cell.needsAttention > 0) {
			return inMonth
				? 'border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/40'
				: 'border-rose-200/60 bg-rose-50/50 dark:border-rose-900/50 dark:bg-rose-950/20';
		}
		if (cell.scheduled > 0) {
			return inMonth
				? 'border-amber-200 bg-amber-50/70 dark:border-amber-900 dark:bg-amber-950/25'
				: 'border-amber-200/50 bg-amber-50/40 dark:border-amber-900/50 dark:bg-amber-950/15';
		}
		if (cell.completed > 0 || cell.no_show > 0) {
			return inMonth
				? 'border-emerald-200 bg-emerald-50/70 dark:border-emerald-900 dark:bg-emerald-950/25'
				: 'border-emerald-200/50 bg-emerald-50/40 dark:border-emerald-900/50 dark:bg-emerald-950/15';
		}
		return inMonth
			? 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
			: 'border-slate-100 bg-slate-50 dark:border-slate-800/50 dark:bg-slate-900/40';
	}
</script>

<header class="mb-3 flex items-center justify-between">
	<div>
		<p class="text-xs font-semibold uppercase tracking-wide text-slate-400">Calendar</p>
		<h1 class="text-xl font-bold">{data.label}</h1>
	</div>
	<div class="flex items-center gap-1.5">
		<a class="chip chip-slate" href="?m={data.prev}" aria-label="Previous month">&larr;</a>
		<a class="chip chip-sky" href="/calendar">Today</a>
		<a class="chip chip-slate" href="?m={data.next}" aria-label="Next month">&rarr;</a>
	</div>
</header>

<div class="grid grid-cols-7 gap-1 pb-1">
	{#each weekdays as day (day)}
		<div class="text-center text-[10px] font-semibold uppercase tracking-wide text-slate-400">
			{day}
		</div>
	{/each}
</div>

<div class="grid grid-cols-7 gap-1">
	{#each data.grid as week, wi (wi)}
		{#each week as date (date)}
			{@const cell = cellFor(date)}
			{@const inMonth = date.startsWith(data.month)}
			{@const isToday = date === data.today}
			<a
				href="/day/{date}"
				class="flex aspect-square flex-col rounded-lg border p-1 transition active:scale-95 {cellClass(
					date
				)} {inMonth ? '' : 'opacity-60'}"
			>
				<span
					class="text-[11px] font-semibold {isToday
						? 'flex h-4 w-4 items-center justify-center rounded-full bg-slate-900 text-white dark:bg-white dark:text-slate-900'
						: 'text-slate-600 dark:text-slate-300'}"
				>
					{Number(date.slice(8, 10))}
				</span>
				{#if cell}
					<span class="mt-auto flex items-center gap-1">
						{#if cell.total > 0}
							<span class="text-[10px] font-semibold text-slate-500 dark:text-slate-400"
								>{cell.total}</span
							>
						{/if}
						{#if cell.needsAttention > 0}
							<span class="h-1.5 w-1.5 rounded-full bg-rose-500"></span>
						{:else if cell.scheduled > 0}
							<span class="h-1.5 w-1.5 rounded-full bg-amber-400"></span>
						{:else if cell.no_show > 0 && cell.completed === 0}
							<span class="h-1.5 w-1.5 rounded-full bg-rose-400"></span>
						{:else if cell.completed > 0}
							<span class="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
						{/if}
						{#if cell.other > 0}
							<span
								class="h-1.5 w-1.5 rounded-full bg-slate-400"
								title="{cell.other} other calendar event{cell.other === 1 ? '' : 's'}"
							></span>
						{/if}
					</span>
				{/if}
			</a>
		{/each}
	{/each}
</div>

<div class="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-slate-500 dark:text-slate-400">
	<span class="flex items-center gap-1.5">
		<span class="h-2.5 w-2.5 rounded-full bg-emerald-500"></span> All confirmed
	</span>
	<span class="flex items-center gap-1.5">
		<span class="h-2.5 w-2.5 rounded-full bg-amber-400"></span> Unconfirmed
	</span>
	<span class="flex items-center gap-1.5">
		<span class="h-2.5 w-2.5 rounded-full bg-rose-500"></span> Needs attention
	</span>
	<span class="flex items-center gap-1.5">
		<span class="h-2.5 w-2.5 rounded-full bg-slate-400"></span> Work/other event
	</span>
</div>

<p class="mt-3 text-xs text-slate-400 dark:text-slate-500">
	Sessions unconfirmed for {data.delayDays}+ days are flagged for cleanup.
</p>

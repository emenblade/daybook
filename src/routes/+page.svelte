<script lang="ts">
	import { enhance } from '$app/forms';
	import AppointmentRow from '#lib/components/AppointmentRow.svelte';
	import ConsentCheck from '#lib/components/ConsentCheck.svelte';
	import OtherEvents from '#lib/components/OtherEvents.svelte';
	import TreatmentPlanCheck from '#lib/components/TreatmentPlanCheck.svelte';
	import {
		fmtDateLong,
		fmtDateSmart,
		fmtHours,
		fmtTsDate,
		fmtTsDateTime,
		relativeDaysText
	} from '#lib/dates.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const syncOk = $derived(data.lastSyncStatus === 'ok');
	const syncLabel = $derived(
		data.calendarSource === 'none'
			? 'Calendar not connected'
			: syncOk
				? 'Calendar synced'
				: data.lastSyncStatus === 'error'
					? 'Sync problem'
					: 'Waiting for first sync'
	);
</script>

<header class="mb-4 flex items-start justify-between gap-3">
	<div>
		<p class="text-xs font-semibold uppercase tracking-wide text-slate-400">Overview</p>
		<h1 class="text-xl font-bold">{fmtDateLong(data.today)}</h1>
	</div>
	<a class="chip chip-sky" href="/kiosk">Open desk view</a>
</header>

<div class="grid grid-cols-2 gap-2">
	<a href="/kiosk" class="card p-3 {data.needsAttentionCount > 0 ? 'border-amber-300' : ''}">
		<p class="text-2xl font-bold leading-none text-amber-600 dark:text-amber-400">
			{data.needsAttentionCount}
		</p>
		<p class="mt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
			to confirm
		</p>
	</a>
	<a href="#long-term" class="card p-3 {data.longTermCount > 0 ? 'border-amber-300' : ''}">
		<p class="text-2xl font-bold leading-none">{data.longTermCount}</p>
		<p class="mt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
			long-term reminders
		</p>
	</a>
	<a href="/hours" class="card p-3">
		<p class="text-2xl font-bold leading-none">{fmtHours(data.hours.totalMinutes)}</p>
		<p class="mt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
			hours this month
		</p>
	</a>
	<div class="card p-3">
		<p class="text-2xl font-bold leading-none">{data.appointments.length}</p>
		<p class="mt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
			appointments today
		</p>
	</div>
</div>

<section class="mt-5">
	<div class="mb-2 flex items-center justify-between">
		<h2 class="font-bold">Today's plan</h2>
		<a class="text-xs font-semibold text-sky-600 dark:text-sky-400" href="/calendar">Calendar</a>
	</div>
	<ul class="space-y-2">
		{#each data.appointments as appointment (appointment.id)}
			<AppointmentRow {appointment} />
		{:else}
			<li class="card p-4 text-center text-sm text-slate-400 dark:text-slate-500">
				No client appointments on the calendar today.
			</li>
		{/each}
	</ul>
	{#if data.otherToday.length > 0}
		<div class="card mt-2 p-3">
			<OtherEvents events={data.otherToday} title="Also today" />
		</div>
	{/if}
</section>

{#if data.needsAttentionCount > 0}
	<section class="mt-5">
		<div class="mb-2 flex items-center justify-between">
			<h2 class="font-bold">Needs attention</h2>
			<span class="pill bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300"
				>{data.needsAttentionCount}</span
			>
		</div>
		<p class="mb-2 text-xs text-slate-500 dark:text-slate-400">
			Appointments with no confirmation for {data.delayDays}+ days. Confirm them or mark a
			no-show; notes still go in Jane.
		</p>
		<ul class="space-y-2">
			{#each data.needsAttention as appointment (appointment.id)}
				<AppointmentRow {appointment} showDate />
			{/each}
		</ul>
		{#if data.needsAttentionCount > data.needsAttention.length}
			<a
				class="mt-2 inline-block text-xs font-semibold text-sky-600 dark:text-sky-400"
				href="/kiosk">See all {data.needsAttentionCount} on the desk view</a
			>
		{/if}
	</section>
{/if}

{#if data.longTermCount > 0}
	<section id="long-term" class="mt-5">
		<div class="mb-2 flex items-center justify-between">
			<h2 class="font-bold">Long-term reminders</h2>
			<span class="pill bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300"
				>{data.longTermCount}</span
			>
		</div>
		<p class="mb-2 text-xs text-slate-500 dark:text-slate-400">
			Follow up when there is no future booking, plus treatment-plan paperwork.
		</p>

		{#if data.followUpCount > 0}
			<h3 class="mb-1 mt-3 text-sm font-bold">
				Follow up
				<span class="ml-1 text-xs font-semibold text-slate-400">{data.followUpCount}</span>
			</h3>
			<p class="mb-2 text-xs text-slate-500 dark:text-slate-400">
				No future booking and last session at least {data.staleDays} days ago.
			</p>
			<ul class="space-y-2">
				{#each data.followUps as client (client.id)}
					<li class="card flex flex-wrap items-center justify-between gap-2 p-3">
						<div class="min-w-0">
							<a class="truncate font-semibold" href="/clients/{client.id}">{client.name}</a>
							<p class="text-xs text-slate-500 dark:text-slate-400">
								Last seen {client.last_seen_at ? fmtTsDate(client.last_seen_at) : 'never'} · {relativeDaysText(
									client.days_since_seen ?? 0
								)} · nothing booked
							</p>
						</div>
						<div class="flex gap-1.5">
							<form method="POST" action="?/setClientStatus" use:enhance>
								<input type="hidden" name="id" value={client.id} />
								<input type="hidden" name="status" value="follow_up" />
								<button class="chip chip-amber">Follow up</button>
							</form>
							<form
								method="POST"
								action="?/setClientStatus"
								use:enhance={({ cancel }) => {
									if (!window.confirm(`Mark ${client.name} as discharged?`)) cancel();
								}}
							>
								<input type="hidden" name="id" value={client.id} />
								<input type="hidden" name="status" value="discharged" />
								<button class="chip chip-slate">Discharged</button>
							</form>
						</div>
					</li>
				{/each}
			</ul>
			{#if data.followUpCount > data.followUps.length}
				<a class="mt-2 inline-block text-xs font-semibold text-sky-600 dark:text-sky-400" href="/clients?followup=due"
					>All {data.followUpCount} follow-ups</a
				>
			{/if}
		{/if}

		{#if data.planReminderCount > 0}
			<h3 class="mb-1 mt-4 text-sm font-bold">
				Treatment plans
				<span class="ml-1 text-xs font-semibold text-slate-400">{data.planReminderCount}</span>
			</h3>
			<ul class="space-y-2">
				{#each data.planReminders as item (item.client.id)}
					<li class="card flex flex-wrap items-center justify-between gap-2 p-3">
						<div class="min-w-0">
							<a class="truncate font-semibold" href="/clients/{item.client.id}"
								>{item.client.name}</a
							>
							<p class="text-xs text-slate-500 dark:text-slate-400">
								{#if item.action.kind === 'complete'}
									Treatment plan not complete
								{:else}
									{item.action.label} due {item.dueOn ? fmtDateSmart(item.dueOn) : ''}
								{/if}
								{#if item.sessionAt}
									· Next session {fmtTsDate(item.sessionAt)}
								{:else}
									· No session booked
								{/if}
							</p>
						</div>
						<TreatmentPlanCheck
							clientId={item.client.id}
							action={item.action}
							compact
							label={item.action.kind === 'complete'
								? 'Plan done'
								: item.action.kind === 'quarterly'
									? 'Review done'
									: 'Remake done'}
						/>
					</li>
				{/each}
			</ul>
			{#if data.planReminderCount > data.planReminders.length}
				<a
					class="mt-2 inline-block text-xs font-semibold text-sky-600 dark:text-sky-400"
					href="/clients?plan=due">All {data.planReminderCount} plans</a
				>
			{/if}
		{/if}
	</section>
{/if}

{#if data.consentDueCount > 0}
	<section class="mt-5">
		<div class="mb-2 flex items-center justify-between">
			<h2 class="font-bold">Consent forms due</h2>
			<span class="pill bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300"
				>{data.consentDueCount}</span
			>
		</div>
		<p class="mb-2 text-xs text-slate-500 dark:text-slate-400">
			Clients without a signed consent for service form. Mark them when they are next in.
		</p>
		<ul class="space-y-2">
			{#each data.consentDue as client (client.id)}
				<li class="card flex items-center justify-between gap-2 p-3">
					<a class="truncate font-semibold" href="/clients/{client.id}">{client.name}</a>
					<ConsentCheck participant={client} compact label="Consent" />
				</li>
			{/each}
		</ul>
		{#if data.consentDueCount > data.consentDue.length}
			<a
				class="mt-2 inline-block text-xs font-semibold text-sky-600 dark:text-sky-400"
				href="/clients?consent=due">All {data.consentDueCount} clients</a
			>
		{/if}
	</section>
{/if}

<section class="card mt-5 p-3">
	<div class="flex items-center justify-between gap-3">
		<div class="min-w-0">
			<p class="flex items-center gap-1.5 text-sm font-semibold">
				<span
					class="h-2 w-2 rounded-full {syncOk
						? 'bg-emerald-500'
						: data.lastSyncStatus === 'error'
							? 'bg-rose-500'
							: 'bg-slate-300'}"
				></span>
				{syncLabel}
			</p>
			<p class="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
				{#if data.lastSyncAt}
					Last sync {fmtTsDateTime(data.lastSyncAt)}
				{:else}
					Connect her Jane calendar to start syncing automatically.
				{/if}
			</p>
		</div>
		{#if data.calendarSource === 'none'}
			<a class="chip chip-sky" href="/sync">Set up</a>
		{:else}
			<form method="POST" action="?/syncNow" use:enhance>
				<button class="chip chip-slate">Sync now</button>
			</form>
		{/if}
	</div>
	{#if data.lastSyncError}
		<p class="mt-2 text-xs font-medium text-rose-600 dark:text-rose-400">{data.lastSyncError}</p>
	{/if}
	{#if form?.error}
		<p class="mt-2 text-xs font-medium text-rose-600 dark:text-rose-400">{form.error}</p>
	{/if}
</section>

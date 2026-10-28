<script lang="ts">
	import { enhance } from '$app/forms';
	import { fmtTsDateTime } from '#lib/dates.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const calendarSourceLabel = $derived(
		data.calendarSource === 'ics'
			? 'Jane ICS feed'
			: data.calendarSource === 'caldav'
				? 'iCloud CalDAV'
				: 'Not connected'
	);
</script>

<header class="mb-4">
	<p class="text-xs font-semibold uppercase tracking-wide text-slate-400">Settings</p>
	<h1 class="text-xl font-bold">Profile, reminders &amp; data</h1>
</header>

<div class="space-y-4">
	<section class="card space-y-3 p-4">
		<h2 class="font-bold">Profile</h2>
		<form method="POST" action="?/saveName" use:enhance class="space-y-2">
			<label class="label" for="name">Name</label>
			<input id="name" class="input" name="name" value={data.user?.name ?? ''} required />
			{#if form?.nameError}
				<p class="text-sm font-medium text-rose-600 dark:text-rose-400">{form.nameError}</p>
			{/if}
			{#if form?.nameSaved}
				<p class="text-sm font-medium text-emerald-600 dark:text-emerald-400">Name saved.</p>
			{/if}
			<button class="btn-secondary w-full">Save name</button>
		</form>

		<form method="POST" action="?/changePin" use:enhance class="space-y-2 border-t border-slate-100 pt-3 dark:border-slate-800">
			<div class="grid grid-cols-3 gap-2">
				<div>
					<label class="label" for="current_pin">Current</label>
					<input
						id="current_pin"
						class="input"
						type="password"
						name="current_pin"
						inputmode="numeric"
						autocomplete="off"
						maxlength="8"
						required
					/>
				</div>
				<div>
					<label class="label" for="new_pin">New</label>
					<input
						id="new_pin"
						class="input"
						type="password"
						name="new_pin"
						inputmode="numeric"
						autocomplete="off"
						maxlength="8"
						required
					/>
				</div>
				<div>
					<label class="label" for="confirm_pin">Again</label>
					<input
						id="confirm_pin"
						class="input"
						type="password"
						name="confirm_pin"
						inputmode="numeric"
						autocomplete="off"
						maxlength="8"
						required
					/>
				</div>
			</div>
			{#if form?.pinError}
				<p class="text-sm font-medium text-rose-600 dark:text-rose-400">{form.pinError}</p>
			{/if}
			{#if form?.pinSaved}
				<p class="text-sm font-medium text-emerald-600 dark:text-emerald-400">PIN changed.</p>
			{/if}
			<button class="btn-secondary w-full">Change PIN</button>
		</form>
	</section>

	<section class="card space-y-3 p-4">
		<h2 class="font-bold">Reminders</h2>
		<form method="POST" action="?/saveReminders" use:enhance class="space-y-2">
			<div class="grid grid-cols-2 gap-2">
				<div>
					<label class="label" for="delayDays">After (days)</label>
					<input
						id="delayDays"
						class="input"
						type="number"
						name="delayDays"
						min="0"
						max="30"
						value={data.reminder.delayDays}
					/>
				</div>
				<div>
					<label class="label" for="reminderTime">At</label>
					<input
						id="reminderTime"
						class="input"
						type="time"
						name="time"
						value={data.reminder.time}
					/>
				</div>
			</div>
			<p class="text-[11px] text-slate-400 dark:text-slate-500">
				Appointments without a confirmation/notes update older than this are flagged on the desk
				device. After the time below, the desk screen shows a reminder banner until they are
				cleared.
			</p>
			<div>
				<label class="label" for="staleDays">Follow up after (days) with no future booking</label>
				<input
					id="staleDays"
					class="input"
					type="number"
					name="staleDays"
					min="1"
					max="365"
					value={data.reminder.staleDays}
				/>
			</div>
			<p class="text-[11px] text-slate-400 dark:text-slate-500">
				Clients with no completed appointment in at least this many days, and nothing booked,
				appear in the “Long-term reminders” section.
			</p>
			{#if form?.reminderError}
				<p class="text-sm font-medium text-rose-600 dark:text-rose-400">{form.reminderError}</p>
			{/if}
			{#if form?.reminderSaved}
				<p class="text-sm font-medium text-emerald-600 dark:text-emerald-400">
					Reminder settings saved.
				</p>
			{/if}
			<button class="btn-secondary w-full">Save reminders</button>
		</form>

	</section>

	<section class="card space-y-3 p-4">
		<h2 class="font-bold">Calendar</h2>
		<p class="text-xs text-slate-500 dark:text-slate-400">
			{data.calendarProvider} · {calendarSourceLabel} · daily sync at {data.calendarSyncTime}{#if data.lastSyncAt}
				· last sync {fmtTsDateTime(data.lastSyncAt)}{/if}
		</p>
		{#if data.lastSyncStatus === 'error'}
			<p class="text-xs font-medium text-rose-600 dark:text-rose-400">
				The last sync failed. Open calendar settings for details.
			</p>
		{/if}
		<a class="btn-secondary w-full" href="/sync">Calendar settings &amp; sync</a>
	</section>

	<section class="card space-y-3 p-4">
		<h2 class="font-bold">Desk device</h2>
		<p class="text-xs text-slate-500 dark:text-slate-400">
			Point the device browser at <code class="rounded bg-slate-100 px-1 dark:bg-slate-800"
				>/kiosk</code
			>. It shows today's plan, the cleanup list, and long-term reminders with large touch
			targets. Add <code class="rounded bg-slate-100 px-1 dark:bg-slate-800">?eink=1</code> for a
			high-contrast, slow-refresh e-ink mode. On Android, lock the tablet to this page with the
			Fully Kiosk Browser app (see the Android guide in the calendar app bundle).
		</p>
		<a class="chip chip-sky" href="/kiosk">Open desk view</a>
	</section>

	<section class="card space-y-3 p-4">
		<h2 class="font-bold">Data &amp; backup</h2>
		<p class="text-xs text-slate-500 dark:text-slate-400">
			Database: <code class="rounded bg-slate-100 px-1 dark:bg-slate-800">{data.dbPath}</code>.
			Everything stays on the NAS.
		</p>
		<div class="flex flex-wrap gap-2">
			<a class="chip chip-sky" href="/api/backup">Download backup</a>
			<a class="chip chip-slate" href="/api/export">Export sessions CSV</a>
		</div>
		{#if data.hasDemo}
			<form
				method="POST"
				action="?/removeDemo"
				use:enhance={({ cancel }) => {
					if (
						!window.confirm(
							'Remove all demo clients, sessions and events? Real synced data is not touched.'
						)
					)
						cancel();
				}}
				class="border-t border-slate-100 pt-3 dark:border-slate-800"
			>
				<button class="chip chip-rose">Remove demo data</button>
				{#if form?.demoRemoved}
					<p class="mt-2 text-sm font-medium text-emerald-600 dark:text-emerald-400">
						Demo data removed.
					</p>
				{/if}
			</form>
		{/if}
	</section>
</div>

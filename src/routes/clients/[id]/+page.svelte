<script lang="ts">
	import { enhance } from '$app/forms';
	import AppointmentRow from '#lib/components/AppointmentRow.svelte';
	import ConsentCheck from '#lib/components/ConsentCheck.svelte';
	import TreatmentPlanCheck from '#lib/components/TreatmentPlanCheck.svelte';
	import { fmtDateSmart, fmtHours, fmtTsDate, tsToDate } from '#lib/dates.ts';
	import { missingPlanAction } from '#lib/treatment.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<header class="mb-4">
	<a href="/clients" class="text-xs font-semibold text-sky-600 dark:text-sky-400"
		>&larr; All clients</a
	>
	<h1 class="mt-1 text-xl font-bold">{data.client.name}</h1>
</header>

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

	<div
		class="mt-2 flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-2 dark:border-slate-800"
	>
		{#if data.client.consent_signed_at}
			<span
				class="chip chip-emerald"
				title="Consent signed {fmtTsDate(data.client.consent_signed_at)}"
			>
				<span class="flex h-3.5 w-3.5 items-center justify-center rounded border-2 border-current">
					<svg
						class="h-3 w-3"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="3"
						stroke-linecap="round"
						stroke-linejoin="round"><path d="m5 12 5 5L20 7" /></svg
					>
				</span>
				Consent signed
			</span>
			<form method="POST" action="?/setClientConsent" use:enhance>
				<input type="hidden" name="id" value={data.client.id} />
				<input type="hidden" name="signed" value="0" />
				<button class="chip chip-slate">Undo</button>
			</form>
		{:else}
			<ConsentCheck participant={data.client} label="Consent due" />
		{/if}

		{#if data.planMissing}
			<TreatmentPlanCheck
				clientId={data.client.id}
				action={missingPlanAction()}
				label={data.planOverdue ? 'Plan overdue' : 'Plan due'}
			/>
		{:else if data.planDue}
			<TreatmentPlanCheck
				clientId={data.client.id}
				action={data.planDue}
				label={data.planDue.kind === 'annual' ? 'Annual plan due' : 'Quarterly review due'}
			/>
		{:else}
			<span class="chip chip-violet">Plan active</span>
		{/if}
	</div>
</section>

<div class="mb-4 space-y-1 text-xs text-slate-500 dark:text-slate-400">
	<p>
		<span class="font-semibold text-slate-600 dark:text-slate-300">Consent:</span>
		{#if data.client.consent_signed_at}
			signed {fmtTsDate(data.client.consent_signed_at)} via {data.client.consent_signed_source ===
			'kiosk'
				? 'desk'
				: data.client.consent_signed_source === 'demo'
					? 'demo data'
					: data.client.consent_signed_source === 'manual'
						? 'manual entry'
						: 'admin'}.
		{:else}
			not signed yet. It stays on session cards until marked.
		{/if}
	</p>
	<p>
		<span class="font-semibold text-slate-600 dark:text-slate-300">Treatment plan:</span>
		{#if data.planMissing}
			{#if data.planOverdue}
				not complete; the third session has passed. It stays on session cards until marked.
			{:else}
				due by the end of session 3 ({data.stats.totalSessions} completed so far).
			{/if}
		{:else}
			completed/remade {data.planInfo.completedOn
				? fmtDateSmart(data.planInfo.completedOn)
				: '—'} · last reviewed {data.planInfo.reviewedOn
				? fmtDateSmart(data.planInfo.reviewedOn)
				: '—'} · quarterly review due {data.planInfo.quarterlyDueOn
				? fmtDateSmart(data.planInfo.quarterlyDueOn)
				: '—'} · annual plan due {data.planInfo.annualDueOn
				? fmtDateSmart(data.planInfo.annualDueOn)
				: '—'}.
		{/if}
	</p>
</div>

<details class="card mb-4 p-3">
	<summary class="cursor-pointer font-bold">Historical data</summary>
	<p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
		Backfill dates from her records. No notes, contacts, or free-text clinical data.
	</p>

	<form method="POST" action="?/setClientDates" use:enhance class="mt-3 space-y-2 border-t border-slate-100 pt-3 dark:border-slate-800">
		<input type="hidden" name="id" value={data.client.id} />
		<p class="text-xs font-semibold uppercase tracking-wide text-slate-400">Historical dates</p>
		<div class="grid gap-2 sm:grid-cols-3">
			<div>
				<label class="label" for="consent_date">Consent signed</label>
				<input
					id="consent_date"
					class="input"
					type="date"
					name="consent_date"
					value={data.client.consent_signed_at ? tsToDate(data.client.consent_signed_at) : ''}
				/>
			</div>
			<div>
				<label class="label" for="plan_completed_date">Plan completed/remade</label>
				<input
					id="plan_completed_date"
					class="input"
					type="date"
					name="plan_completed_date"
					value={data.planInfo.completedOn ?? ''}
				/>
			</div>
			<div>
				<label class="label" for="plan_reviewed_date">Plan last reviewed</label>
				<input
					id="plan_reviewed_date"
					class="input"
					type="date"
					name="plan_reviewed_date"
					value={data.planInfo.reviewedOn ?? ''}
				/>
			</div>
		</div>
		<p class="text-[11px] text-slate-400 dark:text-slate-500">
			Leave a field blank to clear it. Dates cannot be in the future.
		</p>
		{#if form?.datesError}
			<p class="text-sm font-medium text-rose-600 dark:text-rose-400">{form.datesError}</p>
		{/if}
		{#if form?.datesSaved}
			<p class="text-sm font-medium text-emerald-600 dark:text-emerald-400">
				Historical dates saved.
			</p>
		{/if}
		<button class="btn-secondary w-full">Save historical dates</button>
	</form>

	<form method="POST" action="?/addHistoricalSession" use:enhance class="mt-4 space-y-2 border-t border-slate-100 pt-3 dark:border-slate-800">
		<input type="hidden" name="client_id" value={data.client.id} />
		<p class="text-xs font-semibold uppercase tracking-wide text-slate-400">Add a past session</p>
		<div class="grid grid-cols-2 gap-2">
			<div>
				<label class="label" for="history_date">Date</label>
				<input id="history_date" class="input" type="date" name="date" required />
			</div>
			<div>
				<label class="label" for="history_time">Time</label>
				<input id="history_time" class="input" type="time" name="time" required />
			</div>
			<div>
				<label class="label" for="history_duration">Minutes</label>
				<input
					id="history_duration"
					class="input"
					type="number"
					name="duration_min"
					min="5"
					max="480"
					value="60"
					required
				/>
			</div>
			<div>
				<label class="label" for="history_status">Status</label>
				<select id="history_status" class="input" name="status">
					<option value="completed">Completed</option>
					<option value="no_show">No-show</option>
					<option value="client_canceled">Client canceled</option>
				</select>
			</div>
		</div>
		<div>
			<label class="label" for="history_service">Service</label>
			<input
				id="history_service"
				class="input"
				name="service"
				placeholder="In-Person FNIHB/IRS/Bigstone"
			/>
		</div>
		<div class="grid grid-cols-2 gap-2">
			<div>
				<label class="label" for="history_modality">Location type</label>
				<select id="history_modality" class="input" name="modality">
					<option value="auto">Auto from service/location</option>
					<option value="in_person">In person</option>
					<option value="remote">Remote</option>
					<option value="unknown">Unknown</option>
				</select>
			</div>
			<div>
				<label class="label" for="history_provider">Provider</label>
				<input id="history_provider" class="input" name="provider" placeholder={data.providers[0] ?? 'Manual'} />
			</div>
		</div>
		<div>
			<label class="label" for="history_location">Location</label>
			<input id="history_location" class="input" name="location" placeholder="Clinic or Zoom" />
		</div>
		{#if form?.sessionError}
			<p class="text-sm font-medium text-rose-600 dark:text-rose-400">{form.sessionError}</p>
		{/if}
		{#if form?.sessionAdded}
			<p class="text-sm font-medium text-emerald-600 dark:text-emerald-400">
				Past session added.
			</p>
		{/if}
		<button class="btn-secondary w-full">Add past session</button>
	</form>
</details>

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
	{#if data.providers.length > 0}
		<p class="flex justify-between gap-2">
			<span class="text-slate-500 dark:text-slate-400"
				>{data.providers.length === 1 ? 'Provider' : 'Providers'}</span
			>
			<span class="text-right font-semibold">{data.providers.join(', ')}</span>
		</p>
	{/if}
</section>

<section class="mt-5">
	<h2 class="mb-2 font-bold">Appointment history</h2>
	<ul class="space-y-2">
		{#each data.appointments as appointment (appointment.id)}
			<AppointmentRow {appointment} showDate showConsent={false} showPlan={false} />
		{:else}
			<li class="card p-4 text-center text-sm text-slate-400 dark:text-slate-500">
				No appointments recorded yet.
			</li>
		{/each}
	</ul>
</section>

<section class="card mt-4 p-3">
	<h2 class="font-bold">Client data</h2>
	<p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
		Export this client's record before deleting it. Deleting removes the client from Daybook and
		suppresses future syncs of that name; it does not change Jane or the source calendar. Shared
		group/couples appointments remain for the other clients.
	</p>
	<div class="mt-2 flex flex-wrap gap-2">
		<a class="chip chip-sky" href="/api/clients/{data.client.id}/export">Export client data</a>
		<form
			method="POST"
			action="?/deleteClient"
			use:enhance={({ cancel }) => {
				if (
					!window.confirm(
						`Delete ${data.client.name} and suppress future syncs of this name? Export first if you need a copy.`
					)
				)
					cancel();
			}}
		>
			<input type="hidden" name="id" value={data.client.id} />
			<button class="chip chip-rose">Delete client</button>
		</form>
	</div>
</section>

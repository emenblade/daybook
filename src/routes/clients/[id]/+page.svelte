<script lang="ts">
	import { enhance } from '$app/forms';
	import AppointmentRow from '#lib/components/AppointmentRow.svelte';
	import ClientStatusPill from '#lib/components/ClientStatusPill.svelte';
	import TreatmentPlanCheck from '#lib/components/TreatmentPlanCheck.svelte';
	import { fmtDateSmart, fmtHours, fmtTsDate } from '#lib/dates.ts';
	import { missingPlanAction } from '#lib/treatment.ts';
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

<section
	class="card mb-4 p-4 {data.client.consent_signed_at
		? ''
		: 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30'}"
>
	<div class="flex items-center justify-between gap-2">
		<h2 class="font-bold">Consent for service</h2>
		{#if data.client.consent_signed_at}
			<span
				class="pill bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300"
				>Signed</span
			>
		{:else}
			<span class="pill bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300"
				>Due</span
			>
		{/if}
	</div>
	{#if data.client.consent_signed_at}
		<p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
			Signed {fmtTsDate(data.client.consent_signed_at)} via {data.client.consent_signed_source ===
			'kiosk'
				? 'desk'
				: data.client.consent_signed_source === 'demo'
					? 'demo data'
					: 'admin'}.
		</p>
	{:else}
		<p class="mt-1 text-xs text-amber-700 dark:text-amber-300">
			Not signed yet. This keeps appearing on session cards until it is marked.
		</p>
	{/if}
	<form method="POST" action="?/setClientConsent" use:enhance class="mt-2">
		<input type="hidden" name="id" value={data.client.id} />
		<input type="hidden" name="signed" value={data.client.consent_signed_at ? 0 : 1} />
		<button class="chip {data.client.consent_signed_at ? 'chip-slate' : 'chip-amber'}">
			<span class="flex h-4 w-4 items-center justify-center rounded border-2 border-current">
				{#if data.client.consent_signed_at}
					<svg
						class="h-3 w-3"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="3"
						stroke-linecap="round"
						stroke-linejoin="round"><path d="m5 12 5 5L20 7" /></svg
					>
				{/if}
			</span>
			{data.client.consent_signed_at ? 'Undo consent' : 'Mark consent form signed'}
		</button>
	</form>
</section>

<section
	class="card mb-4 p-4 {data.planMissing
		? data.planOverdue
			? 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30'
			: 'border-violet-300 bg-violet-50 dark:border-violet-800 dark:bg-violet-950/30'
		: ''}"
>
	<div class="flex items-center justify-between gap-2">
		<h2 class="font-bold">Treatment plan</h2>
		{#if data.planMissing}
			<span
				class="pill {data.planOverdue
					? 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300'
					: 'bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300'}"
				>{data.planOverdue ? 'Overdue' : 'Due by session 3'}</span
			>
		{:else}
			<span
				class="pill bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300"
				>Active</span
			>
		{/if}
	</div>
	{#if data.planMissing}
		<p class="mt-1 text-xs {data.planOverdue
			? 'text-amber-700 dark:text-amber-300'
			: 'text-violet-700 dark:text-violet-300'}">
			{#if data.planOverdue}
				The third session has passed. Complete the plan and mark it here; the reminder stays on
				session cards until it is done.
			{:else}
				Complete the plan by the end of session 3 ({data.stats.totalSessions} completed so far).
			{/if}
		</p>
		<div class="mt-2">
			<TreatmentPlanCheck
				clientId={data.client.id}
				action={missingPlanAction()}
				label="Mark treatment plan complete"
			/>
		</div>
	{:else}
		<div class="mt-1 space-y-0.5 text-xs text-slate-500 dark:text-slate-400">
			<p>
				Plan completed/remade {data.planInfo.completedOn
					? fmtDateSmart(data.planInfo.completedOn)
					: '—'} · last reviewed {data.planInfo.reviewedOn
					? fmtDateSmart(data.planInfo.reviewedOn)
					: '—'}
			</p>
			<p>
				Quarterly review due {data.planInfo.quarterlyDueOn
					? fmtDateSmart(data.planInfo.quarterlyDueOn)
					: '—'} · annual plan due {data.planInfo.annualDueOn
					? fmtDateSmart(data.planInfo.annualDueOn)
					: '—'}
			</p>
		</div>
		{#if data.planDue}
			<div
				class="mt-2 rounded-xl border border-violet-300 bg-violet-50 p-2 dark:border-violet-800 dark:bg-violet-950/30"
			>
				<p class="text-xs font-semibold text-violet-700 dark:text-violet-300">
					{data.planDue.label} is due.
				</p>
				<div class="mt-1">
					<TreatmentPlanCheck
						clientId={data.client.id}
						action={data.planDue}
						label={data.planDue.kind === 'annual' ? 'Annual plan remade' : 'Quarterly review done'}
					/>
				</div>
			</div>
		{/if}
	{/if}
</section>

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
			<AppointmentRow {appointment} showDate showConsent={false} showPlan={false} />
		{:else}
			<li class="card p-4 text-center text-sm text-slate-400 dark:text-slate-500">
				No appointments recorded yet.
			</li>
		{/each}
	</ul>
</section>

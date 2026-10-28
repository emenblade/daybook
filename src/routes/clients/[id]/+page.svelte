<script lang="ts">
	import { enhance } from '$app/forms';
	import AppointmentRow from '#lib/components/AppointmentRow.svelte';
	import ConsentCheck from '#lib/components/ConsentCheck.svelte';
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

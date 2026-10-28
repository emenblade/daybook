<script lang="ts">
	import { enhance } from '$app/forms';
	import { fmtDuration, fmtTsDate, fmtTsTime } from '#lib/dates.ts';
	import { participantNames, typeLabel } from '#lib/format.ts';
	import type { Appointment } from '#lib/types.ts';
	import { modalityChipClass, modalityLabel } from '#lib/session.ts';
	import { treatmentActionForSession } from '#lib/treatment.ts';
	import ConsentCheck from './ConsentCheck.svelte';
	import TreatmentPlanCheck from './TreatmentPlanCheck.svelte';
	import SessionStatusPill from './SessionStatusPill.svelte';
	import SessionTypePill from './SessionTypePill.svelte';

	let {
		appointment,
		showDate = false,
		showConsent = true,
		showPlan = true
	}: {
		appointment: Appointment;
		showDate?: boolean;
		showConsent?: boolean;
		showPlan?: boolean;
	} = $props();

	const unsigned = $derived(
		appointment.participants.filter((participant) => !participant.consent_signed_at)
	);
	const future = $derived(
		appointment.status === 'scheduled' && appointment.start_ts > new Date().toISOString()
	);
	const completed = $derived(appointment.status === 'completed');
	const noShow = $derived(appointment.status === 'no_show');
	const planActions = $derived(
		appointment.status === 'canceled'
			? []
			: appointment.participants.flatMap((participant) => {
					const action = treatmentActionForSession({
						completedAt: participant.treatment_plan_completed_at,
						reviewedAt: participant.treatment_plan_reviewed_at,
						priorCompletedSessions: participant.prior_completed_sessions,
						sessionStartTs: appointment.start_ts
					});
					return action ? [{ participant, action }] : [];
				})
	);
</script>

<li class="card p-3">
	<div class="flex items-start justify-between gap-2">
		<div class="min-w-0">
			<p class="text-xs font-semibold text-slate-500 dark:text-slate-400">
				{fmtTsTime(appointment.start_ts)}{#if showDate}<span> · {fmtTsDate(appointment.start_ts)}</span>{/if}
				<span> · {fmtDuration(appointment.duration_min)}</span>
			</p>
			{#if appointment.session_type === 'group'}
				<p class="mt-0.5 text-base font-semibold leading-snug">Group session</p>
				<p class="mt-0.5 text-sm text-slate-600 dark:text-slate-300">
					{participantNames(appointment.participants)}
				</p>
			{:else}
				<p class="mt-0.5 text-base font-semibold leading-snug">
					{#each appointment.participants as participant, index (participant.id)}<a
							class="hover:underline"
							href="/clients/{participant.id}">{participant.name}</a
						>{#if index < appointment.participants.length - 1}<span class="text-slate-400"
								>, </span
							>{/if}{/each}
					{#if appointment.participants.length === 0}
						<span class="text-slate-400">Unnamed appointment</span>
					{/if}
				</p>
			{/if}
			<p class="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
				{appointment.service || typeLabel(appointment.session_type)}
			</p>
			{#if appointment.modality !== 'unknown' || appointment.location || appointment.provider}
				<div class="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] text-slate-400 dark:text-slate-500">
					{#if appointment.modality !== 'unknown'}
						<span class="pill {modalityChipClass(appointment.modality)}"
							>{modalityLabel(appointment.modality)}</span
						>
					{/if}
					{#if appointment.location}<span>{appointment.location}</span>{/if}
					{#if appointment.provider}<span>· {appointment.provider}</span>{/if}
				</div>
			{/if}
		</div>
		<div class="flex shrink-0 flex-col items-end gap-1">
			<SessionStatusPill status={appointment.status} {future} />
			<SessionTypePill type={appointment.session_type} count={appointment.participants.length} />
		</div>
	</div>

	{#if appointment.status === 'canceled'}
		<p class="mt-2 text-xs text-slate-400 dark:text-slate-500">
			This appointment was removed from the calendar.
		</p>
	{:else}
		<div class="mt-2 flex flex-wrap items-center gap-1.5">
			<form method="POST" action="?/setSessionStatus" use:enhance>
				<input type="hidden" name="id" value={appointment.id} />
				<input type="hidden" name="status" value={completed ? 'scheduled' : 'completed'} />
				<button class="chip {completed ? 'chip-emerald' : 'chip-slate'}">
					Done + notes in Jane
				</button>
			</form>
			<form method="POST" action="?/setSessionStatus" use:enhance>
				<input type="hidden" name="id" value={appointment.id} />
				<input type="hidden" name="status" value={noShow ? 'scheduled' : 'no_show'} />
				<button class="chip {noShow ? 'chip-rose' : 'chip-slate'}">No-show</button>
			</form>
		</div>
	{/if}

	{#if showConsent && appointment.status !== 'canceled' && unsigned.length > 0}
		<div
			class="mt-2 rounded-xl border border-amber-300 bg-amber-50 p-2 dark:border-amber-800 dark:bg-amber-950/30"
		>
			<p class="text-[10px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300">
				Consent form needed
			</p>
			<div class="mt-1 flex flex-wrap gap-1.5">
				{#each unsigned as participant (participant.id)}
					<ConsentCheck
						{participant}
						showName={appointment.participants.length > 1}
					/>
				{/each}
			</div>
		</div>
	{/if}

	{#if showPlan && planActions.length > 0}
		<div
			class="mt-2 rounded-xl border border-violet-300 bg-violet-50 p-2 dark:border-violet-800 dark:bg-violet-950/30"
		>
			<p class="text-[10px] font-bold uppercase tracking-wide text-violet-700 dark:text-violet-300">
				Treatment plan
			</p>
			<div class="mt-1 flex flex-wrap gap-1.5">
				{#each planActions as { participant, action } (participant.id)}
					<TreatmentPlanCheck
						clientId={participant.id}
						{action}
						name={participant.name}
						showName={appointment.participants.length > 1}
					/>
				{/each}
			</div>
		</div>
	{/if}
</li>

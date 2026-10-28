<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import ConsentCheck from '#lib/components/ConsentCheck.svelte';
	import Logo from '#lib/components/Logo.svelte';
	import OtherEvents from '#lib/components/OtherEvents.svelte';
	import SessionTypePill from '#lib/components/SessionTypePill.svelte';
	import TreatmentPlanCheck from '#lib/components/TreatmentPlanCheck.svelte';
	import { participantNames } from '#lib/format.ts';
	import { modalityChipClass, modalityLabel } from '#lib/session.ts';
	import { treatmentActionForSession } from '#lib/treatment.ts';
	import {
		daysSinceTs,
		fmtDateLong,
		fmtDateSmart,
		fmtDuration,
		fmtTsDate,
		fmtTsDateTime,
		fmtTsTime,
		parseTimeToMin,
		relativeDaysText
	} from '#lib/dates.ts';
	import type { Appointment } from '#lib/types.ts';
	import type { PageProps } from './$types';

	type KioskAppointment = Appointment & { past: boolean };

	let { data }: PageProps = $props();

	let clock = $state('');
	let nowMinutes = $state(0);
	const eink = $derived(page.url.searchParams.get('eink') === '1');
	const reminderMinutes = $derived(parseTimeToMin(data.reminderTime) ?? 17 * 60);
	const showReminder = $derived(
		(data.needsAttentionCount > 0 ||
			data.consentDueCount > 0 ||
			data.planDueCount > 0) &&
			nowMinutes >= reminderMinutes
	);

	onMount(() => {
		const updateClock = () => {
			const now = new Date();
			clock = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
			nowMinutes = now.getHours() * 60 + now.getMinutes();
		};
		updateClock();
		const clockTimer = setInterval(updateClock, 15_000);
		const refreshTimer = setInterval(
			() => void invalidateAll(),
			eink ? 5 * 60_000 : 60_000
		);
		const onVisible = () => {
			if (document.visibilityState === 'visible') void invalidateAll();
		};
		document.addEventListener('visibilitychange', onVisible);
		return () => {
			clearInterval(clockTimer);
			clearInterval(refreshTimer);
			document.removeEventListener('visibilitychange', onVisible);
		};
	});

	const syncLabel = $derived(
		data.lastSyncStatus === 'error'
			? 'Calendar sync problem'
			: data.lastSyncAt
				? `Synced ${fmtTsDateTime(data.lastSyncAt)}`
				: 'Calendar not connected'
	);

	function statusLine(appointment: KioskAppointment): string {
		if (appointment.status === 'completed') return 'Notes in Jane';
		if (appointment.status === 'no_show') return 'No-show';
		if (appointment.past) return 'Past — needs confirmation';
		return 'Upcoming';
	}

	function planActions(appointment: Appointment) {
		return appointment.participants.flatMap((participant) => {
			const action = treatmentActionForSession({
				completedAt: participant.treatment_plan_completed_at,
				reviewedAt: participant.treatment_plan_reviewed_at,
				priorCompletedSessions: participant.prior_completed_sessions,
				sessionStartTs: appointment.start_ts
			});
			return action ? [{ participant, action }] : [];
		});
	}
</script>

{#snippet toggleButtons(appointment: KioskAppointment, compact = false)}
	<form method="POST" action="?/setSessionStatus" use:enhance>
		<input type="hidden" name="id" value={appointment.id} />
		<input
			type="hidden"
			name="status"
			value={appointment.status === 'no_show' ? 'scheduled' : 'no_show'}
		/>
		<button
			class="flex items-center justify-center gap-2 rounded-xl border-2 font-bold transition active:scale-95 {compact
				? 'min-h-10 px-3 text-sm'
				: 'min-h-12 px-3 text-sm'} {appointment.status === 'no_show'
				? 'border-rose-500 bg-rose-500 text-white'
				: 'border-slate-300 bg-white text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300'}"
		>
			<span
				class="flex items-center justify-center rounded border-2 {compact ? 'h-4 w-4' : 'h-5 w-5'} {appointment.status ===
				'no_show'
					? 'border-white bg-white/20'
					: 'border-current'}"
			>
				{#if appointment.status === 'no_show'}
					<svg
						class="h-3.5 w-3.5"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="3"
						stroke-linecap="round"
						stroke-linejoin="round"><path d="m5 12 5 5L20 7" /></svg
					>
				{/if}
			</span>
			No-show
		</button>
	</form>
	<form method="POST" action="?/setSessionStatus" use:enhance>
		<input type="hidden" name="id" value={appointment.id} />
		<input
			type="hidden"
			name="status"
			value={appointment.status === 'completed' ? 'scheduled' : 'completed'}
		/>
		<button
			class="flex items-center justify-center gap-2 rounded-xl border-2 font-bold transition active:scale-95 {compact
				? 'min-h-10 px-3 text-sm'
				: 'min-h-12 px-4 text-sm'} {appointment.status === 'completed'
				? 'border-emerald-500 bg-emerald-500 text-white'
				: 'border-slate-300 bg-white text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300'}"
		>
			<span
				class="flex items-center justify-center rounded border-2 {compact ? 'h-4 w-4' : 'h-5 w-5'} {appointment.status ===
				'completed'
					? 'border-white bg-white/20'
					: 'border-current'}"
			>
				{#if appointment.status === 'completed'}
					<svg
						class="h-3.5 w-3.5"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="3"
						stroke-linecap="round"
						stroke-linejoin="round"><path d="m5 12 5 5L20 7" /></svg
					>
				{/if}
			</span>
			Done + notes in Jane
		</button>
	</form>
{/snippet}

{#snippet paperworkButtons(appointment: Appointment, compact = false)}
	{@const unsigned = appointment.participants.filter(
		(participant) => !participant.consent_signed_at
	)}
	{@const plans = planActions(appointment)}
	{#each unsigned as participant (participant.id)}
		<ConsentCheck
			{participant}
			variant="desk"
			{compact}
			showName={appointment.participants.length > 1}
		/>
	{/each}
	{#each plans as { participant, action } (participant.id)}
		<TreatmentPlanCheck
			clientId={participant.id}
			{action}
			name={participant.name}
			variant="desk"
			{compact}
			label={compact ? action.shortLabel : undefined}
			showName={appointment.participants.length > 1}
		/>
	{/each}
{/snippet}

<div
	class="flex min-h-dvh flex-col bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100 {eink
		? 'eink'
		: ''}"
>
	<header
		class="flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900 lg:px-6"
	>
		<div class="flex items-center gap-3">
			<Logo class="h-9 w-9 text-teal-600 dark:text-teal-400" />
			<div>
				<p class="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Daybook</p>
				<h1 class="text-xl font-bold leading-tight lg:text-2xl">{fmtDateLong(data.today)}</h1>
			</div>
		</div>
		<div class="flex items-center gap-4">
			<div class="text-right">
				<p class="text-3xl font-bold tabular-nums leading-none lg:text-4xl">{clock || '—'}</p>
				<p class="mt-1 text-[10px] font-medium text-slate-400">{syncLabel}</p>
			</div>
			{#if eink}
				<a
					href="/kiosk?eink=1"
					data-sveltekit-reload
					class="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:border-slate-600 dark:text-slate-300"
					>Refresh</a
				>
			{/if}
		</div>
	</header>

	{#if showReminder}
		<div
			class="border-b-2 border-amber-500 bg-amber-100 px-4 py-2.5 text-center text-sm font-bold text-amber-900 dark:border-amber-600 dark:bg-amber-950/60 dark:text-amber-200"
		>
			{#if data.needsAttentionCount > 0}
				{data.needsAttentionCount} appointment{data.needsAttentionCount === 1 ? '' : 's'} still need
				confirmation for more than {data.delayDays} days.
			{/if}
			{#if data.consentDueCount > 0}
				{data.consentDueCount} consent form{data.consentDueCount === 1 ? '' : 's'} outstanding.
			{/if}
			{#if data.planDueCount > 0}
				{data.planDueCount} treatment plan reminder{data.planDueCount === 1 ? '' : 's'} due.
			{/if}
			{#if data.needsAttentionCount > 0}
				Please enter the notes in Jane and clean up the “Needs attention” list.
			{/if}
			{#if data.consentDueCount > 0}
				Mark consent forms when the client is next in.
			{/if}
			{#if data.planDueCount > 0}
				Complete treatment plan paperwork when the client is next in.
			{/if}
		</div>
	{/if}

	<main class="grid flex-1 gap-3 p-3 lg:grid-cols-[1.7fr_1fr] lg:gap-4 lg:p-4">
		<div class="flex flex-col gap-3 lg:gap-4">
			<section class="card flex flex-col p-3 lg:p-4">
				<div class="flex items-baseline justify-between">
					<h2 class="text-lg font-bold lg:text-xl">Today's plan</h2>
					<span class="text-sm font-medium text-slate-500 dark:text-slate-400"
						>{data.appointments.length} appointment{data.appointments.length === 1
							? ''
							: 's'}</span
					>
				</div>

				<ul class="mt-3 space-y-2">
					{#each data.appointments as appointment (appointment.id)}
						<li
							class="rounded-2xl border-2 p-2.5 {appointment.status === 'scheduled' &&
							appointment.past
								? 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30'
								: appointment.status === 'completed'
									? 'border-emerald-200 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/20'
									: appointment.status === 'no_show'
										? 'border-rose-200 bg-rose-50/60 dark:border-rose-900 dark:bg-rose-950/20'
										: 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900'}"
						>
							<div class="flex flex-wrap items-center gap-3">
								<div class="w-20 shrink-0 lg:w-24">
									<p class="text-lg font-bold leading-none">{fmtTsTime(appointment.start_ts)}</p>
									<p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
										{fmtDuration(appointment.duration_min)}
									</p>
								</div>
								<div class="min-w-0 flex-1">
									{#if appointment.session_type === 'group'}
										<p class="text-lg font-bold leading-snug lg:text-xl">Group session</p>
										<p class="text-xs text-slate-600 dark:text-slate-300">
											{participantNames(appointment.participants)}
										</p>
									{:else}
										<p class="text-lg font-bold leading-snug lg:text-xl">
											{participantNames(appointment.participants)}
										</p>
									{/if}
									<div class="flex flex-wrap items-center gap-1.5">
										<p
											class="text-xs font-medium {appointment.status === 'scheduled' &&
											appointment.past
												? 'text-amber-700 dark:text-amber-400'
												: 'text-slate-500 dark:text-slate-400'}"
										>
											{statusLine(appointment)}
										</p>
										<SessionTypePill
											type={appointment.session_type}
											count={appointment.participants.length}
										/>
									</div>
									<p class="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">
										{appointment.service}
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
							</div>
							<div class="mt-2 flex flex-wrap gap-2">
								{@render toggleButtons(appointment)}
								{@render paperworkButtons(appointment)}
							</div>
						</li>
					{:else}
						<li
							class="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-slate-400 dark:border-slate-700 dark:text-slate-500"
						>
							No client appointments on the calendar today.
						</li>
					{/each}
				</ul>

				{#if data.otherToday.length > 0}
					<div class="mt-3 border-t border-slate-100 pt-2 dark:border-slate-800">
						<OtherEvents events={data.otherToday} title="Also on the calendar" />
					</div>
				{/if}
			</section>


		</div>

		<div class="flex flex-col gap-3 lg:gap-4">
			<section class="card p-3 lg:p-4">
				<div class="flex items-center justify-between gap-2">
					<h2 class="text-lg font-bold lg:text-xl">Needs attention</h2>
					{#if data.needsAttentionCount > 0}
						<span
							class="pill bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300"
							>{data.needsAttentionCount}</span
						>
					{/if}
				</div>
				<p class="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
					Not confirmed within {data.delayDays} days.
				</p>
				{#if data.needsAttention.length === 0}
					<p
						class="mt-3 rounded-xl bg-emerald-50 p-3 text-sm font-medium text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
					>
						All caught up — every past appointment is confirmed.
					</p>
				{:else}
					<ul class="mt-2 max-h-[34vh] space-y-2 overflow-y-auto pr-1 lg:max-h-none">
						{#each data.needsAttention as appointment (appointment.id)}
							{@const kiosk = { ...appointment, past: true }}
								<li class="rounded-xl border border-slate-200 p-2.5 dark:border-slate-700">
								<div class="flex flex-wrap items-center justify-between gap-2">
									<div class="min-w-0">
										{#if appointment.session_type === 'group'}
											<p class="truncate font-semibold">Group session</p>
											<p class="truncate text-[11px] text-slate-500 dark:text-slate-400">
												{participantNames(appointment.participants)}
											</p>
										{:else}
											<p class="truncate font-semibold">
												{participantNames(appointment.participants)}
											</p>
										{/if}
										<p class="text-[11px] text-slate-500 dark:text-slate-400">
											{fmtTsDate(appointment.start_ts)} · {relativeDaysText(
												daysSinceTs(appointment.start_ts)
											)}
											{#if appointment.session_type !== 'individual'}
												· {appointment.session_type === 'group' ? 'Group' : 'Couples'}
											{/if}
										</p>
										{#if appointment.modality !== 'unknown' || appointment.location}
											<p class="flex flex-wrap items-center gap-x-1.5 text-[11px] text-slate-400 dark:text-slate-500">
												{#if appointment.modality !== 'unknown'}
													<span class="pill {modalityChipClass(appointment.modality)}"
														>{modalityLabel(appointment.modality)}</span
													>
												{/if}
												{#if appointment.location}<span>{appointment.location}</span>{/if}
												{#if appointment.provider}<span>· {appointment.provider}</span>{/if}
											</p>
										{/if}
									</div>
									<div class="flex flex-wrap gap-1.5">
										{@render toggleButtons(kiosk, true)}
										{@render paperworkButtons(appointment, true)}
									</div>
								</div>
							</li>
						{/each}
					</ul>
				{/if}
			</section>

			<section class="card p-3 lg:p-4">
				<div class="flex items-center justify-between gap-2">
					<h2 class="text-lg font-bold lg:text-xl">Long-term reminders</h2>
					{#if data.longTermCount > 0}
						<span class="pill bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300"
							>{data.longTermCount}</span
						>
					{/if}
				</div>
				<p class="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
					Follow up when there is no future booking, plus treatment plans.
				</p>
				{#if data.longTermCount === 0}
					<p
						class="mt-3 rounded-xl bg-emerald-50 p-3 text-sm font-medium text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
					>
						No follow-ups or treatment plans need attention.
					</p>
				{:else}
					{#if data.followUpCount > 0}
						<h3 class="mt-3 text-sm font-bold">
							Follow up
							<span class="ml-1 text-xs font-semibold text-slate-400">{data.followUpCount}</span>
						</h3>
						<p class="text-[11px] text-slate-500 dark:text-slate-400">
							No future booking · at least {data.staleDays} days since last session.
						</p>
						<ul class="mt-1 max-h-[24vh] space-y-2 overflow-y-auto pr-1 lg:max-h-none">
							{#each data.followUps as client (client.id)}
								<li class="rounded-xl border border-slate-200 p-2.5 dark:border-slate-700">
									<div class="flex flex-wrap items-center justify-between gap-2">
										<div class="min-w-0">
											<p class="truncate font-semibold">{client.name}</p>
											<p class="text-[11px] text-slate-500 dark:text-slate-400">
												Last seen {client.last_seen_at
													? fmtTsDate(client.last_seen_at)
													: 'never'}{client.days_since_seen !== null
													? ` · ${client.days_since_seen}d`
													: ''}
											</p>
										</div>
										<div class="flex flex-wrap gap-1.5">
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
									</div>
								</li>
							{/each}
						</ul>
					{/if}

					{#if data.planReminderCount > 0}
						<h3 class="mt-3 text-sm font-bold">
							Treatment plans
							<span class="ml-1 text-xs font-semibold text-slate-400"
								>{data.planReminderCount}</span
							>
						</h3>
						<ul class="mt-1 max-h-[32vh] space-y-2 overflow-y-auto pr-1 lg:max-h-none">
							{#each data.planReminders as item (item.client.id)}
								<li class="rounded-xl border border-slate-200 p-2.5 dark:border-slate-700">
									<div class="flex flex-wrap items-center justify-between gap-2">
										<div class="min-w-0">
											<p class="truncate font-semibold">{item.client.name}</p>
											<p class="text-[11px] text-slate-500 dark:text-slate-400">
												{#if item.action.kind === 'complete'}
													Treatment plan not complete
												{:else}
													{item.action.shortLabel} due {item.dueOn
														? fmtDateSmart(item.dueOn)
														: ''}
												{/if}
												{#if item.sessionAt}
													· Session {fmtTsDate(item.sessionAt)}
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
									</div>
								</li>
							{/each}
						</ul>
					{/if}
				{/if}
			</section>

			<section class="card p-3 lg:p-4">
				<div class="flex items-center justify-between gap-2">
					<h2 class="text-lg font-bold lg:text-xl">Consent forms</h2>
					{#if data.consentDueCount > 0}
						<span class="pill bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300"
							>{data.consentDueCount}</span
						>
					{/if}
				</div>
				<p class="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
					Clients without a signed consent for service form.
				</p>
				{#if data.consentDue.length === 0}
					<p
						class="mt-3 rounded-xl bg-emerald-50 p-3 text-sm font-medium text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
					>
						All consent forms are signed.
					</p>
				{:else}
					<ul class="mt-2 max-h-[28vh] space-y-2 overflow-y-auto pr-1 lg:max-h-none">
						{#each data.consentDue as client (client.id)}
							<li class="flex items-center justify-between gap-2 rounded-xl border border-slate-200 p-2.5 dark:border-slate-700">
								<a href="/clients/{client.id}" class="truncate text-sm font-semibold"
									>{client.name}</a
								>
								<ConsentCheck participant={client} compact label="Consent" />
							</li>
						{/each}
					</ul>
					{#if data.consentDueCount > data.consentDue.length}
						<a
							href="/clients?consent=due"
							class="mt-2 inline-block text-xs font-semibold text-sky-600 dark:text-sky-400"
							>All {data.consentDueCount} clients</a
						>
					{/if}
				{/if}
			</section>
		</div>
	</main>
</div>

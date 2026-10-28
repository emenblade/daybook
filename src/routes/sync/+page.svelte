<script lang="ts">
	import { enhance } from '$app/forms';
	import { fmtTsDateTime } from '#lib/dates.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	let source = $state<string | null>(null);
	const selectedSource = $derived(source ?? data.config.source);
	const categoryLabel: Record<string, string> = {
		session: 'Session',
		break: 'Break',
		work: 'Work',
		personal: 'Personal',
		vacation: 'Vacation',
		other: 'Other',
		duplicate: 'Placeholder'
	};
</script>

<header class="mb-4">
	<a href="/settings" class="text-xs font-semibold text-sky-600 dark:text-sky-400"
		>&larr; Settings</a
	>
	<div class="mt-1">
		<p class="text-xs font-semibold uppercase tracking-wide text-slate-400">Calendar sync</p>
		<h1 class="text-xl font-bold">Connect Jane's calendar</h1>
	</div>
</header>

{#if data.lastSyncStatus === 'error'}
	<div
		class="card mb-4 border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300"
	>
		<p class="font-semibold">Last sync failed</p>
		<p class="mt-0.5 text-xs">{data.lastSyncError}</p>
	</div>
{:else if data.lastSyncAt}
	<div
		class="card mb-4 border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
	>
		Last successful sync: {fmtTsDateTime(data.lastSyncAt)}
	</div>
{/if}

<section class="card space-y-3 p-4">
	<div class="flex items-center justify-between">
		<h2 class="font-bold">Source</h2>
		{#if data.config.source !== 'none'}
			<form method="POST" action="?/syncNow" use:enhance>
				<button class="chip chip-sky">Sync now</button>
			</form>
		{/if}
	</div>

	<form method="POST" action="?/saveSource" use:enhance class="space-y-3">
		<div>
			<label class="label" for="source">Calendar source</label>
			<select
				id="source"
				class="input"
				name="source"
				value={data.config.source}
				onchange={(event) => (source = event.currentTarget.value)}
			>
				<option value="none">Not connected yet</option>
				<option value="ics">ICS feed URL (public/shared calendar)</option>
				<option value="caldav">iCloud CalDAV (private, app-specific password)</option>
			</select>
		</div>

		{#if selectedSource === 'ics'}
			<div>
				<label class="label" for="icsUrl">ICS / webcal URL</label>
				<input
					id="icsUrl"
					class="input"
					name="icsUrl"
					value={data.config.icsUrl}
					placeholder="webcal://p123-caldav.icloud.com/published/2/..."
				/>
				<p class="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
					On iPhone: Calendar → the calendar → Share → Public Calendar, then copy the link.
				</p>
			</div>
		{/if}

		{#if selectedSource === 'caldav'}
			<div class="space-y-3">
				<div>
					<label class="label" for="caldavServer">CalDAV server</label>
					<input
						id="caldavServer"
						class="input"
						name="caldavServer"
						value={data.config.caldavServer}
						placeholder="https://caldav.icloud.com"
					/>
				</div>
				<div class="grid grid-cols-2 gap-3">
					<div>
						<label class="label" for="caldavUsername">Apple ID</label>
						<input
							id="caldavUsername"
							class="input"
							name="caldavUsername"
							value={data.config.caldavUsername}
							autocomplete="off"
						/>
					</div>
					<div>
						<label class="label" for="caldavPassword">App-specific password</label>
						<input
							id="caldavPassword"
							class="input"
							type="password"
							name="caldavPassword"
							value={data.config.caldavPassword}
							autocomplete="new-password"
						/>
					</div>
				</div>
				<div>
					<label class="label" for="caldavCalendar">Calendar name (optional)</label>
					<input
						id="caldavCalendar"
						class="input"
						name="caldavCalendar"
						value={data.config.caldavCalendar}
						placeholder="Work"
					/>
				</div>
				<p class="text-[11px] text-slate-400 dark:text-slate-500">
					Create an app-specific password at appleid.apple.com → Sign-In and Security. Leave
					the calendar name blank to use the first calendar on the account.
				</p>
			</div>
		{/if}

		<div>
			<label class="label" for="providerName">Provider label</label>
			<input
				id="providerName"
				class="input"
				name="providerName"
				value={data.config.providerName}
				placeholder="Jane"
			/>
			<p class="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
				Shown on every session from this calendar so clients from different providers can be
				distinguished.
			</p>
		</div>

		<div>
			<label class="label" for="syncTime">Daily sync time</label>
			<input
				id="syncTime"
				class="input"
				type="time"
				name="syncTime"
				value={data.config.syncTime}
			/>
		</div>

		{#if form?.sourceError}
			<p class="text-sm font-medium text-rose-600 dark:text-rose-400">{form.sourceError}</p>
		{/if}
		{#if form?.sourceSaved}
			<p class="text-sm font-medium text-emerald-600 dark:text-emerald-400">Source saved.</p>
		{/if}

		<button class="btn-primary w-full">Save calendar source</button>
	</form>
</section>

<section class="card mt-4 space-y-3 p-4">
	<h2 class="font-bold">Upload an .ics file</h2>
	<p class="text-xs text-slate-500 dark:text-slate-400">
		Handy for testing the parser before the automatic sync is set up.
	</p>
	<form method="POST" action="?/uploadIcs" enctype="multipart/form-data" class="space-y-2">
		<input
			class="input py-2 text-sm file:mr-3 file:rounded-full file:border-0 file:bg-slate-100 file:px-3 file:py-1 file:text-xs file:font-semibold dark:file:bg-slate-700"
			type="file"
			name="file"
			accept=".ics,text/calendar"
		/>
		{#if form?.uploadError}
			<p class="text-sm font-medium text-rose-600 dark:text-rose-400">{form.uploadError}</p>
		{/if}
		{#if form?.uploadMessage}
			<p class="text-sm font-medium text-emerald-600 dark:text-emerald-400">
				{form.uploadMessage}
			</p>
		{/if}
		<button class="btn-secondary w-full">Upload &amp; parse</button>
	</form>
</section>

<section class="card mt-4 space-y-3 p-4">
	<div class="flex items-center justify-between">
		<h2 class="font-bold">Parsing rules</h2>
		<a class="text-xs font-semibold text-sky-600 dark:text-sky-400" href="/sync">Reset view</a>
	</div>
	<p class="text-xs text-slate-500 dark:text-slate-400">
		The defaults match Jane's <code class="rounded bg-slate-100 px-1 dark:bg-slate-800"
			>First L. (Service)</code
		> titles, including file IDs like
		<code class="rounded bg-slate-100 px-1 dark:bg-slate-800">DEC#113536</code> and optional date
		prefixes, and ignore <code class="rounded bg-slate-100 px-1 dark:bg-slate-800">Break - …</code>.
		Each name pattern needs a <code class="rounded bg-slate-100 px-1 dark:bg-slate-800"
			>(?&lt;client&gt;...)</code
		> group. Exclusion patterns win.
	</p>
	<p class="text-[11px] text-slate-400 dark:text-slate-500">
		Need help writing rules? See <code class="rounded bg-slate-100 px-1 dark:bg-slate-800"
			>CALENDAR-PARSING-AI-GUIDE.md</code
		> in the source bundle for an AI-assisted workflow.
	</p>
	<form method="POST" action="?/saveRules" use:enhance class="space-y-2">
		<textarea class="input font-mono text-xs" name="rules" rows="14">{JSON.stringify(data.rules, null, 2)}</textarea>
		{#if form?.rulesError}
			<p class="text-sm font-medium text-rose-600 dark:text-rose-400">{form.rulesError}</p>
		{/if}
		{#if form?.rulesSaved}
			<p class="text-sm font-medium text-emerald-600 dark:text-emerald-400">Rules saved.</p>
		{/if}
		<button class="btn-secondary w-full">Save rules</button>
	</form>

	<form method="POST" action="?/testParse" use:enhance class="mt-3 space-y-2 border-t border-slate-100 pt-3 dark:border-slate-800">
		<p class="text-xs font-semibold uppercase tracking-wide text-slate-400">Test a title</p>
		<input class="input" name="summary" placeholder="Avery N. (In-Person FNIHB/IRS/Bigstone)" />
		<textarea
			class="input"
			name="description"
			rows="2"
			placeholder="Jane descriptions are usually empty or 'confirmed'"></textarea>
		<button class="btn-secondary w-full">Test parse</button>
		{#if form?.test}
			<div class="rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-800/60">
				{#if form.test.excluded}
					<p class="font-semibold text-slate-500 dark:text-slate-400">Excluded</p>
					<p class="text-xs">{form.test.reason}</p>
				{:else if form.test.name}
					<p class="font-semibold text-emerald-700 dark:text-emerald-300">
						Client: {form.test.name}
					</p>
					{#if form.test.service}
						<p class="text-xs text-slate-500 dark:text-slate-400">
							Service: {form.test.service}
						</p>
					{/if}
					<p class="text-xs text-slate-500 dark:text-slate-400">
						Matched in the {form.test.sourceField} field.
					</p>
				{:else}
					<p class="font-semibold text-rose-600 dark:text-rose-400">No client found</p>
					<p class="text-xs">{form.test.reason}</p>
				{/if}
			</div>
		{/if}
	</form>
</section>

<section class="card mt-4 overflow-hidden">
	<h2 class="border-b border-slate-100 px-3 py-2 text-sm font-bold dark:border-slate-800">
		Recent syncs
	</h2>
	<ul class="divide-y divide-slate-100 text-sm dark:divide-slate-800">
		{#each data.runs as run (run.id)}
			<li class="px-3 py-2">
				<p class="flex items-center justify-between gap-2">
					<span class="font-medium">{run.source}</span>
					<span
						class="pill {run.ok
							? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300'
							: run.ok === 0
								? 'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300'
								: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}"
						>{run.ok ? 'OK' : run.ok === 0 ? 'Failed' : 'Running'}</span
					>
				</p>
				<p class="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
					{fmtTsDateTime(run.started_at)} · {run.message ?? '…'}
				</p>
			</li>
		{:else}
			<li class="p-3 text-sm text-slate-400">No syncs yet.</li>
		{/each}
	</ul>
</section>

<details class="card mt-4 overflow-hidden">
	<summary
		class="cursor-pointer border-b border-slate-100 px-3 py-2 text-sm font-bold dark:border-slate-800"
	>
		Event diagnostics
	</summary>
	<p class="px-3 pt-2 text-[11px] text-slate-400 dark:text-slate-500">
		Routine breaks are hidden. Real sessions that show as Other or Work need a parsing rule;
		use “Test a title” above to check the exact wording.
	</p>
	<ul class="mt-1 divide-y divide-slate-100 text-sm dark:divide-slate-800">
		{#each data.events as event (event.id)}
			<li class="px-3 py-2">
				<p class="flex items-center justify-between gap-2">
					<span class="truncate font-medium">{event.summary || '(no title)'}</span>
					{#if event.removed}
						<span class="pill bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
							>Removed</span
						>
					{:else if event.event_kind === 'client'}
						<span
							class="pill bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300"
							>{event.parsed_client}</span
						>
					{:else}
						<span class="pill bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
							>{categoryLabel[event.category] ?? event.category}</span
						>
					{/if}
				</p>
				<p class="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
					{fmtTsDateTime(event.start_ts)} · {event.source}
					{#if event.service}· {event.service}{/if}
					{#if event.location}· {event.location}{/if}
				</p>
				{#if event.parseReason}
					<p class="text-[11px] text-amber-600 dark:text-amber-400">{event.parseReason}</p>
				{/if}
				{#if event.description}
					<details class="mt-1">
						<summary class="cursor-pointer text-[11px] text-slate-400">Description</summary>
						<pre
							class="mt-1 whitespace-pre-wrap rounded-lg bg-slate-50 p-2 text-xs text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">{event.description}</pre>
					</details>
				{/if}
			</li>
		{:else}
			<li class="p-3 text-sm text-slate-400">
				No events yet. Upload an .ics file or run a sync.
			</li>
		{/each}
	</ul>
</details>

{#if data.trackingStart}
	<p class="mt-4 text-[11px] text-slate-400 dark:text-slate-500">
		Tracking started {data.trackingStart}. Events before that date are imported as completed
		history so they do not create reminder backlog.
	</p>
{/if}

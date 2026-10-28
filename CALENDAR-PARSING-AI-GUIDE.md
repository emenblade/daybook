# Calendar Parsing AI Guide

This guide is for using an AI assistant to turn a calendar export into a Daybook
parsing profile. It intentionally contains **no client names, addresses, or other
private calendar details**. Keep the generated profile private.

## What to give the AI

Give the assistant a sanitized copy of the calendar, ideally an `.ics` export or
a table of events with these fields:

- calendar/provider name
- event title (the Jane/calendar summary)
- description
- location
- start and end time
- all-day or recurring flag
- a few examples of each kind of event: client sessions, couples/family/group
  sessions, breaks, meetings, personal errands, vacation, and anything else

Also tell the assistant what the practice needs to track: consent forms,
treatment plans, other recurring client paperwork, in-person vs remote sessions,
and how providers/calendars should be distinguished.

## What the AI should produce

### 1. Daybook parse rules

A JSON object that can be pasted into **Sync → Parsing rules**:

```json
{
  "summaryPatterns": ["regex with a (?<client>...) group"],
  "descriptionPatterns": ["optional regex with (?<client>...) and (?<service>...) groups"],
  "excludePatterns": ["regex for non-client blocks"],
  "defaultDurationMin": 60
}
```

Requirements:

- Every summary/description pattern must contain a named `(?<client>...)`
  group. A `(?<service>...)` group is optional.
- Patterns are compiled case-insensitively with Unicode support.
- Exclusion patterns win over name patterns.
- Do not hard-code one person's name. Match the *shape* of the title: initials,
  full names, file IDs, date prefixes, parentheses, etc.
- Avoid patterns broad enough to turn meetings or errands into clients. Test
  against false positives.
- Keep the final rules in a private/session file, not in the public repository.

### 2. A calendar profile (for the general-purpose version)

Daybook currently accepts `parseRules` only. The profile below documents the
rest of the calendar logic so it can be implemented or reused later:

```json
{
  "providers": [
    {
      "name": "Provider or calendar display name",
      "source": "ics | caldav | upload",
      "clientNameHints": ["optional title patterns"],
      "requirements": ["consent", "treatment-plan"]
    }
  ],
  "nonClientRules": {
    "break": ["keywords or title prefixes"],
    "work": ["meetings", "admin", "supervision", "case consult"],
    "personal": ["appointments", "errands", "airport", "pickup"],
    "vacation": ["vacation", "time off", "holiday"],
    "other": []
  },
  "modalityRules": {
    "remote": ["video", "virtual", "zoom", "teams", "online", "phone", "telehealth"],
    "inPerson": ["in-person", "office", "clinic", "suite", "physical address"]
  },
  "requirements": [
    {
      "key": "consent",
      "label": "Consent form",
      "dueAfterSessions": 1,
      "reviewEveryDays": 0,
      "remakeEveryDays": 0,
      "providerScope": "all"
    },
    {
      "key": "treatment-plan",
      "label": "Treatment plan",
      "dueAfterSessions": 3,
      "reviewEveryDays": 90,
      "remakeEveryDays": 365,
      "providerScope": "all"
    }
  ]
}
```

Meaning of the requirement parameters:

- `dueAfterSessions`: completed sessions before the item becomes due.
- `reviewEveryDays`: 0 means no recurring review.
- `remakeEveryDays`: 0 means no recurring remake.
- `providerScope`: `all`, or a provider name when the rule differs by provider.

## Analysis checklist for the AI

1. **Client titles.** Find the recurring title shapes. Separate the client name
   from the service and any file/reference number. Strip a leading appointment
   date. Do not include reference numbers in the display name unless the practice
   explicitly wants them.
2. **Grouping.** Identify couples, family, and group formats. The same-time
   events should resolve to one appointment, not one appointment per attendee.
3. **Non-client blocks.** Classify breaks, work/meetings, personal errands,
   vacation, and anything else. These should be visible on the day/desk view but
   must never create note reminders.
4. **Locations and modality.** Extract the location from the event. Infer
   in-person vs remote from service text and location text. Treat phone/video/
   online as remote; treat a physical address or in-person service as in-person.
5. **Providers.** Record which calendar/provider each event came from. A client
   can have appointments from more than one provider; keep the client record
   shared but keep the provider on each appointment.
6. **Requirements.** Decide which client paperwork the practice tracks and what
   its due/review/remake rules are. Keep provider-specific rules separate.

## Validation

1. Paste the generated rules into **Sync → Parsing rules → Save rules**.
2. Use **Test a title** on at least:
   - a normal client session
   - a session with a file/reference number
   - a session with a date prefix
   - a couples/family/group session
   - a break, meeting, personal errand, and vacation
3. Upload a sanitized `.ics` file and inspect **Event diagnostics**. Every real
   client session should show the cleaned client name and service; every
   non-client item should show the right category.
4. Check the day/desk view: sessions should show modality/location/provider, and
   breaks/meetings/errands should appear as non-actionable entries.
5. Check the Hours view and CSV export for modality/provider breakdowns.

## Privacy

- Never commit a real calendar export, client names, file numbers, addresses, or
  provider-specific rules to a public repository.
- Keep the generated profile in a private/session folder.
- Sanitize examples before sharing them in an issue or pull request.

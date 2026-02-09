# Testing

## Framework Overview

| Framework | Purpose | Command |
|-----------|---------|---------|
| Vitest | Unit & integration tests | `npm run test` |
| Playwright | E2E browser tests | `npm run test:e2e` |
| Testing Library | React component testing | (via Vitest) |

## Running Tests

```bash
npm run test                # All unit/integration tests (watch mode)
npm run test -- --run       # Run once (CI mode)
npm run test:unit           # Only unit tests
npm run test:integration    # Only integration tests
npm run test:e2e            # E2E tests
npm run test:coverage       # Coverage report
npm run test -- tests/unit/lib/hubspot.test.ts  # Specific file
npm run test -- --grep "round-robin"            # Pattern match
```

## Test File Structure

```
tests/
├── setup.ts                  # Global test configuration
├── mocks/
│   └── supabase.ts           # Comprehensive Supabase mock factory
├── unit/
│   └── lib/
│       ├── auth.test.ts              # Session management, token refresh (21 tests)
│       ├── availability.test.ts      # Slot generation logic (14 tests)
│       ├── booking-constraints.test.ts # Validation rules (29 tests)
│       ├── email-html.test.ts        # HTML email templates (90 tests)
│       ├── email-templates.test.ts  # Email template processing (31 tests)
│       ├── email-validation.test.ts  # Email format/MX/disposable (21 tests)
│       ├── errors.test.ts            # Error sanitization, user-friendly messages (30 tests)
│       ├── hubspot.test.ts           # HubSpot API integration (25 tests)
│       ├── ical.test.ts              # iCal generation, calendar URLs (21 tests)
│       ├── round-robin.test.ts       # Host selection strategies (16 tests)
│       ├── routing.test.ts           # Lead routing rules, encoding (30 tests)
│       ├── slack.test.ts             # Slack webhook integration (43 tests)
│       ├── sms.test.ts               # Phone validation, templates (35 tests)
│       ├── session-topics.test.ts    # Session topics extraction (21 tests)
│       ├── timezone.test.ts          # Timezone formatting utilities (48 tests)
│       ├── url-handling.test.ts      # URL utilities (29 tests)
│       └── google-meet.test.ts       # Google Meet attendance sync (17 tests)
├── integration/
│   └── api/
│       ├── attendee-types.test.ts        # Batch attendee type fetching (8 tests)
│       ├── auth.test.ts                  # Auth disconnect/reconnect (3 tests)
│       ├── auto-attendance.test.ts       # Google Meet attendance sync (21 tests)
│       ├── automated-emails-toggle.test.ts # Per-event email toggle (10 tests)
│       ├── batch-context.test.ts         # Batch HubSpot context (8 tests)
│       ├── bookings.test.ts              # Booking API endpoints (7 tests)
│       ├── events.test.ts               # Event CRUD operations (13 tests)
│       ├── feedback.test.ts             # Feedback submission (8 tests)
│       ├── manage.test.ts               # Manage/cancel/reschedule bookings (9 tests)
│       ├── reliability.test.ts          # Reliability fixes validation (13 tests)
│       ├── silent-failures.test.ts     # Silent failure prevention (6 tests)
│       ├── send-followup.test.ts        # Follow-up emails (10 tests)
│       ├── attendee-management.test.ts  # Admin add/remove attendees (16 tests)
│       ├── slot-deletion.test.ts       # Permanent/soft slot deletion (8 tests)
│       ├── post-session.test.ts          # Post-session cron job (23 tests)
│       ├── send-reminders.test.ts       # Reminder cron job (17 tests)
│       ├── slots.test.ts               # Slot generation API (11 tests)
│       └── verify-migrations.test.ts    # Migration verification (6 tests)
└── e2e/
    ├── booking-flow.spec.ts          # Public booking flows (13 tests)
    ├── critical-booking-flow.spec.ts # Critical path monitoring (9 tests)
    ├── critical-booking-path.spec.ts # Complete booking journey (4 tests)
    ├── production-health-check.spec.ts # Multi-event booking test with cleanup (5 tests)
    └── round-robin-booking.spec.ts   # Team booking + admin UI (12 tests)
```

## Writing Tests

**Mock Supabase queries** using the factory in `tests/mocks/supabase.ts`:
```typescript
import { createMockSupabase, createMockEvent, createMockBooking } from '../../mocks/supabase';

const mockSupabase = createMockSupabase({
  events: [createMockEvent({ name: 'Test' })],
  bookings: [],
});
```

**Mock external services** (Google, HubSpot, Slack):
```typescript
vi.mock('@/lib/google', () => ({
  addAttendeeToEvent: vi.fn().mockResolvedValue(undefined),
}));
```

**Dynamic import tests need explicit timeouts:** Tests that use `vi.resetModules()` + `await import()` for route handlers can exceed the default 5000ms timeout when the full suite runs in parallel. Always add `{ timeout: 15000 }` to these tests or their parent `describe` block:
```typescript
// Per-test timeout
it('requires eventId parameter', { timeout: 15000 }, async () => {
  const { GET } = await import('@/app/api/slots/route');
  // ...
});

// Or per-describe timeout (preferred when all tests use dynamic imports)
describe('Send Follow-up API', { timeout: 15000 }, () => {
  // all tests here get 15s timeout
});
```

## E2E Test Requirements

E2E tests require a running dev server. Playwright automatically starts it via the config:
```typescript
// playwright.config.ts
webServer: {
  command: 'npm run dev',
  url: 'http://localhost:3000',
}
```

Run with `RUN_E2E=true npm run test:e2e` to force tests in non-Chromium browsers.

## Critical Booking Flow Tests

The `critical-booking-flow.spec.ts` file contains tests specifically designed to catch issues like the "slot not found" bug. These tests:

1. **Test the exact database queries** used in booking creation
2. **Verify slot-event joins** work correctly (the query that broke)
3. **Test the full booking form submission** flow
4. **Validate API error handling** for malformed inputs

**Run locally:**
```bash
npm run test:e2e -- tests/e2e/critical-booking-flow.spec.ts
```

**Monitor production:**
```bash
MONITOR_URL=https://liveschoolhelp.com npm run test:e2e -- tests/e2e/critical-booking-flow.spec.ts
```

## Production Health Check (Multi-Event)

The `production-health-check.spec.ts` tests active events by creating real bookings:

1. **Discovers active public events** from `/api/events` (filtered by host if specified)
2. **Attempts a test booking** on each event that has available slots
3. **Cleans up** by canceling each test booking via the manage token
4. **Reports results** with pass/fail summary

**IMPORTANT:** Test bookings create real Google Calendar events on the host's calendar. Use `MONITOR_HOST_EMAIL` to limit testing to your own events only.

**Run against production (recommended - YOUR events only):**
```bash
MONITOR_URL=https://liveschoolhelp.com MONITOR_HOST_EMAIL=you@company.com \
  npm run test:e2e -- tests/e2e/production-health-check.spec.ts
```

**Run against production (ALL events - creates calendar events for all hosts):**
```bash
MONITOR_URL=https://liveschoolhelp.com npm run test:e2e -- tests/e2e/production-health-check.spec.ts
```

**Output example:**
```
📋 Found 3 active events hosted by you@company.com:
   - LiveSchool Office Hours (group) [liveschool-office-hours]
   - Quick Chat (one_on_one) [quick-chat]

🔍 Testing: LiveSchool Office Hours (group)
   ✅ Booking created: abc-123
...

🧹 Cleaning up 2 test bookings...
   ✅ Cancelled booking for liveschool-office-hours

📊 HEALTH CHECK SUMMARY
✅ Successful bookings: 2
⏭️ No available slots: 1
```

**Calendar cleanup:** Canceling test bookings removes the test attendee from the calendar event, but the calendar event itself remains. After running the health check, manually delete any test calendar events from your calendar.

**Use for scheduled monitoring:** Run daily via GitHub Actions or cron to catch booking issues before users do. Test bookings use `@example.com` emails (IANA reserved domain).

## Booking Health Check Endpoint

`GET /api/health/booking` - Tests critical booking database queries.

**What it checks:**
- Slots table query
- Slot-event foreign key join (the query that broke)
- Bookings count query
- Full booking slot query with all joins

**Use for monitoring:** Set up an external monitor (e.g., Uptime Robot, Pingdom) to hit this endpoint every 5-15 minutes. Alert if status is not `ok` or if latency exceeds thresholds.

## Test Coverage Summary

| Area | Tests |
|------|-------|
| **Total Unit Tests** | **529** |
| **Integration Tests** | **197** |
| **E2E Tests** | **43** |
| **Grand Total** | **769** |

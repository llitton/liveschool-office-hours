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
│       ├── email-html.test.ts        # HTML email templates (54 tests)
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
│       ├── auto-attendance.test.ts       # Google Meet attendance sync (6 tests)
│       ├── automated-emails-toggle.test.ts # Per-event email toggle (10 tests)
│       ├── batch-context.test.ts         # Batch HubSpot context (8 tests)
│       ├── bookings.test.ts              # Booking API endpoints (7 tests)
│       ├── events.test.ts               # Event CRUD operations (13 tests)
│       ├── feedback.test.ts             # Feedback submission (8 tests)
│       ├── manage.test.ts               # Manage/cancel bookings (8 tests)
│       ├── reliability.test.ts          # Reliability fixes validation (13 tests)
│       ├── silent-failures.test.ts     # Silent failure prevention (6 tests)
│       ├── send-followup.test.ts        # Follow-up emails (10 tests)
│       ├── slots.test.ts               # Slot generation API (11 tests)
│       └── verify-migrations.test.ts    # Migration verification (6 tests)
└── e2e/
    ├── booking-flow.spec.ts          # Public booking flows
    ├── critical-booking-flow.spec.ts # Critical path monitoring (9 tests)
    └── round-robin-booking.spec.ts   # Team booking + admin UI
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
| **Total Unit Tests** | **498** |
| **Integration Tests** | **117** |
| **E2E Tests** | **9** |
| **Grand Total** | **624** |

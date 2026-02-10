# Security & Reliability

## User-Friendly Error Messages
The app uses `src/lib/errors.ts` to provide consistent, user-friendly error messages:
- `getUserFriendlyError(error)` - Converts database errors to human-readable messages
- `CommonErrors` - Standard error messages for common scenarios (NOT_FOUND, UNAUTHORIZED, etc.)
- PostgreSQL error codes (23505, 23503, etc.) are mapped to helpful explanations
- Technical details are sanitized from user-facing messages

## Auth Resilience
`getSession()` returns the admin record even when Google token refresh fails — this allows auth-only operations (saving settings, availability patterns) to succeed. Only operations that actually call Google API (calendar sync, email send) will fail with a stale token.

**`requireAuth()` throws — always catch it:**
```typescript
// CORRECT
let session;
try {
  session = await requireAuth();
} catch {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

// WRONG — requireAuth() throws, so the null check is dead code
const session = await requireAuth();
if (!session) {  // never reached
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

**Client-side error handling for save operations:**
```typescript
if (!response.ok) {
  if (response.status === 401) {
    throw new Error('Your session has expired. Please refresh the page and try again.');
  }
  const data = await response.json().catch(() => null);
  throw new Error(data?.error || 'Failed to save');
}
```

## Google API Retry Logic
All Google Calendar and Gmail API calls include automatic retry with exponential backoff:
- Max 3 retries for transient failures
- Handles rate limits (429), server errors (5xx), network issues
- Exponential backoff: 1s -> 2s -> 4s (with jitter)
- Non-retryable errors fail immediately

## Integration Status Tracking
When a booking is created, the API returns integration status:
```json
{
  "id": "booking-id",
  "integrations": {
    "calendar": "sent" | "failed" | "skipped",
    "email": "sent" | "failed" | "skipped",
    "calendarError": "...",
    "emailError": "..."
  }
}
```
The booking confirmation page shows a warning banner if calendar/email failed.

## Serverless Background Tasks
Vercel serverless functions terminate shortly after the response is returned. **All async operations must be awaited before returning the response.**

**What doesn't work:**
```typescript
// DON'T DO THIS - function may terminate before completion
someAsyncTask().catch(console.error);  // fire and forget
(async () => { await slowOperation(); })();  // async IIFE
```

**What works:**
```typescript
// DO THIS - await with timeout to prevent blocking
try {
  await Promise.race([
    externalApiCall(),
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000)),
  ]);
} catch (err) {
  console.error('External API failed:', err);  // log but don't fail the request
}
return NextResponse.json(result);
```

**Guidelines:**
- **All operations must be awaited** before returning the response - no fire-and-forget
- Use `Promise.race` with a timeout for external APIs (HubSpot, Slack, etc.)
- Non-critical failures should be caught and logged, not propagated to the user

## External API Timeout Conventions
All `fetch()` calls to external services **must** include a timeout:

```typescript
// Use AbortController for fetch-based calls
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 5000);
const response = await fetch(url, { signal: controller.signal });
clearTimeout(timeoutId);
```

**Standard timeouts:**
| Service | Timeout | Method |
|---------|---------|--------|
| Slack webhooks | 5s | `AbortController` |
| HubSpot API | 5s | `Promise.race` |
| Twilio SMS | 10s | `AbortController` |
| Aircall SMS | 10s | `AbortController` |

## Cron Job Safety
Cron jobs running on Vercel have execution time limits. Follow these patterns:
- **Batch limits:** Process max 100 items per run to prevent timeout (e.g., reminder emails)
- **Error reporting:** Return `503` when >50% of operations fail (not `{ success: true }`)
- **Query error checking:** Always destructure and check `error` on slot/booking queries
- **Sent-at tracking:** After sending an email, check the sent-at timestamp update succeeded
- **Token refresh:** Google OAuth2 client handles refresh automatically when `refresh_token` is provided
- **Idempotency:** Use sent-at timestamp fields to prevent duplicate sends

## Input Validation
Validate all user inputs at API boundaries:
- **UUID fields:** Validate format with `/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i`
- **Rating fields:** Must be integer 1-5 (`Number.isInteger(n) && n >= 1 && n <= 5`)
- **Capacity checks:** Re-verify slot capacity immediately before booking/rescheduling updates
- **Batch API limits:** Endpoints accepting arrays (emails, IDs) must enforce max size (100)
- **Host email validation:** `host_email` must belong to a registered admin in `oh_admins`

## HTML & Slack Escaping
- **HTML emails:** Use `escapeHtml()` from `src/lib/email-html.ts` on ALL user-provided strings before embedding in HTML. Template functions escape internally. Inline HTML in API routes must call `escapeHtml()` explicitly.
- **Slack messages:** User-provided text in Slack mrkdwn must go through `escapeSlackMarkdown()` in `src/lib/slack.ts` to prevent formatting manipulation via `<`, `>`, `&` characters.

## Structured Logging
Use `src/lib/logger.ts` for consistent logging instead of `console.log`:
```typescript
import { calendarLogger, bookingLogger } from '@/lib/logger';

bookingLogger.info('Round-robin assigned host', {
  operation: 'createBooking',
  eventId: '...',
  metadata: { hostEmail: 'host@example.com', reason: 'least_bookings' },
});

calendarLogger.error('Failed to create event', {
  operation: 'createCalendarEvent',
  eventId: '...',
  adminId: '...'
}, error);
```

**Available loggers:** `calendarLogger`, `emailLogger`, `hubspotLogger`, `smsLogger`, `bookingLogger`, `slotLogger`, `slackLogger`, `cronLogger`

**Output format:**
- Production: JSON for log aggregation
- Development: Human-readable with context

**Log levels:** `debug` (dev only), `info`, `warn`, `error`

# Connect with LiveSchool

Full-featured scheduling platform replacing Calendly/HubSpot Scheduler. Supports one-on-one, group, round-robin, collective, panel, and webinar meeting types.

**Live URL:** https://liveschoolhelp.com

## Tech Stack

- **Framework:** Next.js 14+ (App Router), React 19, TypeScript
- **Database:** Supabase (PostgreSQL)
- **Styling:** Tailwind CSS 4
- **Auth:** Google OAuth 2.0
- **Integrations:** Google Calendar/Gmail/Meet, HubSpot, Slack, Microsoft Calendar
- **SMS:** Aircall, Twilio, MessageBird (abstracted)
- **Testing:** Vitest (unit/integration), Playwright (e2e)
- **Deployment:** Vercel

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── admin/              # Protected admin dashboard
│   ├── book/[slug]/        # Public booking page
│   ├── embed/[slug]/       # Embeddable widget
│   ├── route/[slug]/       # Lead routing forms
│   ├── vote/[slug]/        # Availability polls
│   ├── api/                # API routes (~97 endpoints)
│   └── icon.svg            # Favicon (calendar + checkmark in brand purple)
├── components/             # React components (32 files)
├── lib/                    # Business logic (22 modules)
├── contexts/               # React Context providers
├── hooks/                  # Custom hooks
└── types/                  # TypeScript definitions

migrations/                 # SQL migrations
chrome-extension/           # Browser extension for quick link access
tests/                      # Unit, integration, e2e tests
```

## Key Files

| Purpose | Location |
|---------|----------|
| Availability calculation | `src/lib/availability.ts` |
| Round-robin assignment | `src/lib/round-robin.ts` |
| Booking validation | `src/lib/booking-constraints.ts` |
| Google Calendar/Gmail | `src/lib/google.ts` |
| HubSpot integration | `src/lib/hubspot.ts` |
| SMS abstraction | `src/lib/sms.ts`, `src/lib/sms-providers/` |
| Lead routing | `src/lib/routing.ts` |
| Auth utilities | `src/lib/auth.ts` |
| Error utilities | `src/lib/errors.ts` |
| Structured logging | `src/lib/logger.ts` |
| Type definitions | `src/types/index.ts` |

## Database Tables (Supabase)

Core tables prefixed with `oh_`:
- `oh_admins` - User accounts, Google tokens, settings
- `oh_events` - Event/meeting configurations
- `oh_slots` - Time slots with Google Meet links
- `oh_bookings` - Individual bookings with tracking fields
- `oh_availability_patterns` - Recurring availability
- `oh_busy_blocks` - Google Calendar sync + manual blocks
- `oh_event_hosts` - Multi-host with roles (owner/host/backup)
- `oh_round_robin_state` - Round-robin tracking
- `oh_routing_forms` / `oh_routing_rules` - Lead routing
- `oh_polls` - Availability voting
- `oh_sms_config` / `oh_sms_logs` - SMS configuration

### Database Security (Row Level Security)

All tables have Row Level Security (RLS) enabled. This is critical for Supabase security.

**How RLS Works:**
- `service_role` key (used by API routes via `getServiceSupabase()`) **bypasses RLS** - full access
- `anon` key (public) is restricted by RLS policies
- Migrations in `migrations/006_enable_rls.sql` and `migrations/031_enable_rls_missing_tables.sql`

**Table Access Levels:**

| Access Level | Tables | Notes |
|--------------|--------|-------|
| **Admin-only** (service_role) | `oh_admins`, `oh_sms_config`, `oh_hubspot_config`, `oh_slack_config`, `oh_availability_patterns`, `oh_busy_blocks`, `oh_company_holidays`, `oh_task_templates`, `oh_session_templates` | Contain sensitive data (tokens, API keys) |
| **Public read** | `oh_events` (active only), `oh_slots` (available only), `oh_prep_resources` | For public booking pages |
| **Public read/write** | `oh_bookings`, `oh_poll_votes` | Attendees can create bookings and submit votes |
| **Public read** (polls) | `oh_polls`, `oh_poll_options`, `oh_poll_invitees` | For /vote/[slug] pages |

**When Adding New Tables:**
1. Always enable RLS: `ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;`
2. Create appropriate policies based on access needs
3. Tables with sensitive data (API keys, tokens) should have NO public policies
4. Check Supabase dashboard for "RLS Disabled" warnings

**Example Policy (public read for active items):**
```sql
CREATE POLICY "Public can view active events"
ON oh_events FOR SELECT
TO anon, authenticated
USING (is_active = true);
```

## Commands

```bash
npm run dev              # Start dev server (localhost:3000)
npm run build            # Production build
npm run lint             # ESLint
```

## Testing

### Test Framework Overview

| Framework | Purpose | Command |
|-----------|---------|---------|
| Vitest | Unit & integration tests | `npm run test` |
| Playwright | E2E browser tests | `npm run test:e2e` |
| Testing Library | React component testing | (via Vitest) |

### Running Tests

```bash
# Run all unit/integration tests (watch mode)
npm run test

# Run tests once (CI mode)
npm run test -- --run

# Run only unit tests
npm run test:unit

# Run only integration tests
npm run test:integration

# Run E2E tests
npm run test:e2e

# Generate coverage report
npm run test:coverage

# Run specific test file
npm run test -- tests/unit/lib/hubspot.test.ts

# Run tests matching a pattern
npm run test -- --grep "round-robin"
```

### Test File Structure

```
tests/
├── setup.ts                  # Global test configuration
├── mocks/
│   └── supabase.ts           # Comprehensive Supabase mock factory
├── unit/
│   └── lib/
│       ├── auth.test.ts              # Session management, token refresh
│       ├── availability.test.ts      # Slot generation logic
│       ├── booking-constraints.test.ts # Validation rules
│       ├── hubspot.test.ts           # HubSpot API integration
│       ├── round-robin.test.ts       # Host selection strategies
│       ├── slack.test.ts             # Slack webhook integration
│       ├── sms.test.ts               # Phone validation, templates
│       └── timezone.test.ts          # Timezone formatting utilities
├── integration/
│   └── api/
│       ├── bookings.test.ts          # Booking API endpoints
│       ├── events.test.ts            # Event CRUD operations
│       └── slots.test.ts             # Slot generation API
└── e2e/
    ├── booking-flow.spec.ts          # Public booking flows
    └── round-robin-booking.spec.ts   # Team booking + admin UI
```

### Test Coverage Areas

| Area | Coverage | Files |
|------|----------|-------|
| Auth & Sessions | 100% | `auth.ts` |
| Timezone Utilities | 100% | `timezone.ts` |
| Slack Integration | 100% | `slack.ts` |
| SMS Utilities | ~80% | `sms.ts` |
| Booking Constraints | ~79% | `booking-constraints.ts` |
| HubSpot Integration | ~50% | `hubspot.ts` |
| Availability Logic | ~47% | `availability.ts` |
| API Routes | ~40% | Various API endpoints |
| **Overall** | **~37%** | All lib files |

### Writing Tests

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

### E2E Test Requirements

E2E tests require a running dev server. Playwright automatically starts it via the config:
```typescript
// playwright.config.ts
webServer: {
  command: 'npm run dev',
  url: 'http://localhost:3000',
}
```

Run with `RUN_E2E=true npm run test:e2e` to force tests in non-Chromium browsers.

## Branding

| Element | Value | Notes |
|---------|-------|-------|
| **Primary Purple** | `#6F71EE` | Main brand color, buttons, links |
| **Navy** | `#101E57` | Headers, dark text |
| **Green** | `#417762` | Success states, confirmations |
| **Favicon** | `src/app/icon.svg` | Calendar with checkmark in brand purple |

The favicon is an SVG calendar icon with a checkmark, designed to be recognizable at small sizes in browser tabs. Next.js App Router automatically serves `icon.svg` as the favicon.

## Environment

Copy `.env.local.example` to `.env.local`. Required:
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `NEXT_PUBLIC_APP_URL`

## Key Patterns

### Meeting Types
Six types in `MeetingType` enum: `one_on_one`, `group`, `collective`, `round_robin`, `panel`, `webinar`

### Round-Robin Strategies
Four strategies (enforced by DB CHECK constraint after migration 029):
- `priority` - **Recommended.** Like Calendly's "Maximize Availability" - shows all slots, assigns to highest-priority available host
- `least_bookings` - Load balanced, assigns to host with fewest bookings
- `cycle` - Simple rotation A→B→C
- `availability_weighted` - More bookings to hosts with more open time

Host priorities (1-10 weight slider) are set in `oh_event_hosts.priority` column, configured in event settings. The UI shows expected percentage distribution based on weights (e.g., weight 6 + weight 4 = 60%/40% split).

### Event Templates
Templates capture a complete event configuration for quick reuse. Stored in `oh_session_templates` table.

**What templates capture:**
- Meeting type, duration, max attendees
- Booking rules (notice, window, daily/weekly limits, approval required)
- Buffer times, start time increments
- Timezone settings
- Guest settings
- Email templates (confirmation, reminder, cancellation, no-show)
- SMS templates (24h and 1h reminders)
- Waitlist settings
- Custom questions and prep materials
- Banner image, subtitle
- "Allow Any Time" setting (ignore_busy_blocks)
- Slack notification preference

**Creating templates:**
- From event settings: Click "Save as Template" to capture all current settings
- System templates are pre-defined (is_system = true)
- Custom templates are user-created (created_by = admin_id)

**Applying templates:**
- On new event page, "Quick Start" section shows available templates
- Clicking a template applies ALL fields to the form
- Auto-generates unique slug (e.g., "demo-event-2" if "demo-event" exists)
- Host name/email NOT copied (assigned dynamically or from current user)

**Managing templates:**
- View all templates at `/admin/settings/templates`
- Edit custom templates by clicking the pencil icon (system templates are read-only)
- Delete custom templates with the trash icon
- Edit page allows updating name, description, meeting type, and all settings

**APIs:**
- `GET /api/session-templates` - List all templates
- `GET /api/session-templates/[id]` - Get single template
- `PUT /api/session-templates/[id]` - Update custom template
- `DELETE /api/session-templates/[id]` - Delete custom template
- `POST /api/events/[id]/save-as-template` - Save event as template
- `GET /api/events/check-slug?slug=xxx` - Check slug availability

**Database:** `oh_session_templates` table (migration 033 added extended fields)

### HubSpot Meeting Types
Events can be mapped to HubSpot meeting types (hs_activity_type) for tracking:
- Fetch available types via `GET /api/hubspot/meeting-types`
- Set `hubspot_meeting_type` on `oh_events` table (migration 030)
- When bookings sync to HubSpot, the meeting is tagged with the selected type
- Appears as "Call and meeting type" field in HubSpot reports

### Booking Flow
1. Public page loads event config
2. Client calculates available slots (availability patterns - busy blocks - buffers)
3. Attendee selects slot, fills form
4. POST `/api/bookings` creates booking
5. Syncs to Google Calendar, sends confirmation email

### Allow Any Time (Internal Booking Links)
For ad-hoc bookings outside normal availability, enable "Allow Any Time" in event settings:
- Bypasses availability patterns AND Google Calendar conflict checks
- Generates slots from 6am-10pm every day
- Company holidays still block bookings
- Existing slot conflicts still prevented (no double-booking)
- Useful for internal booking links only you use, but still get HubSpot tracking, reminders, etc.
- Stored as `ignore_busy_blocks` boolean on `oh_events` (migration 032)

### Google Calendar Integration
- **Event titles:** Calendar events use the event name directly (e.g., "Office Hours"), no prefix added
- **Co-host invitations:**
  - **Webinars:** All co-hosts receive calendar invitations regardless of role (owner, host, or backup)
  - **Collective events:** Only hosts with "owner" or "host" roles receive invitations (uses `getParticipatingHosts()`)
  - Implementation: Webinars use `getAllEventHosts()` from `src/lib/round-robin.ts` which includes all roles
- **Attendee invitations:** When someone books, they're added as an attendee to the existing calendar event
- **Retroactive fixes:** Use `POST /api/slots/add-cohosts` with `{"event_id": "..."}` to add co-hosts to existing calendar events

### Multi-Host
Events can have multiple hosts via `oh_event_hosts` with roles and permissions (`can_manage_slots`, `can_view_bookings`):
- **owner:** Primary host, full permissions
- **host:** Participating host, included in round-robin distribution and collective availability checks
- **backup:** Receives calendar invitations for webinars but not included in round-robin/collective assignment

### Team Member Invitations
Team members are added via `/admin/team` (now under People → Team in nav):
- **Invitation tracking:** `invitation_sent_at` and `invitation_last_sent_at` columns on `oh_admins` (migration 039)
- **Status display:** "Active" (Google connected) vs "Pending" (waiting to connect Google)
- **Resend capability:** `POST /api/admin/team/[id]/resend-invite` sends reminder email
- **Email content:** Subject says "Reminder:" for resends, points to `/admin` to get started
- **Requirements:** Inviter must have Google connected to send emails via Gmail API

## Error Handling & Reliability

### User-Friendly Error Messages
The app uses `src/lib/errors.ts` to provide consistent, user-friendly error messages:
- `getUserFriendlyError(error)` - Converts database errors to human-readable messages
- `CommonErrors` - Standard error messages for common scenarios (NOT_FOUND, UNAUTHORIZED, etc.)
- PostgreSQL error codes (23505, 23503, etc.) are mapped to helpful explanations
- Technical details are sanitized from user-facing messages

### Google API Retry Logic
All Google Calendar and Gmail API calls include automatic retry with exponential backoff:
- Max 3 retries for transient failures
- Handles rate limits (429), server errors (5xx), network issues
- Exponential backoff: 1s → 2s → 4s (with jitter)
- Non-retryable errors fail immediately

### Integration Status Tracking
When a booking is created, the API returns integration status:
```json
{
  "id": "booking-id",
  "integrations": {
    "calendar": "sent" | "failed" | "skipped",
    "email": "sent" | "failed" | "skipped",
    "calendarError": "...",  // Only if failed
    "emailError": "..."      // Only if failed
  }
}
```
The booking confirmation page shows a warning banner if calendar/email failed.

### Serverless Background Tasks
Vercel serverless functions terminate shortly after the response is returned. **"Fire and forget" patterns don't work reliably.**

**What doesn't work:**
```typescript
// DON'T DO THIS - function may terminate before completion
someAsyncTask().catch(console.error);  // fire and forget
(async () => { await slowOperation(); })();  // async IIFE
```

**What works:**
```typescript
// DO THIS - await before returning response
await someAsyncTask();  // runs synchronously
return NextResponse.json(result);
```

**Guidelines:**
- Critical operations (Slack notifications, analytics) must complete before response
- Non-critical operations (HubSpot sync) can use fire-and-forget but may fail silently
- If an external API is slow (>2s), consider skipping enrichment rather than blocking
- Add timeouts to prevent slow APIs from blocking the response

### Structured Logging
Use `src/lib/logger.ts` for consistent logging:
```typescript
import { calendarLogger, bookingLogger } from '@/lib/logger';

calendarLogger.error('Failed to create event', {
  operation: 'createCalendarEvent',
  eventId: '...',
  adminId: '...'
}, error);
```
- JSON output in production (for log aggregation)
- Human-readable format in development
- Pre-configured loggers: `calendarLogger`, `emailLogger`, `hubspotLogger`, `smsLogger`, `bookingLogger`

### Database Constraints (Migration 034)
CHECK constraints prevent invalid data at the database level:
- `oh_slots`: start_time must be before end_time
- `oh_events`: duration 1-480 minutes, positive max_attendees, non-negative buffers

## Conventions

- Use server components by default, client components only when needed
- API routes return `{ error: string }` on failure with appropriate status codes
- Use `getUserFriendlyError()` or `CommonErrors` for error responses (not raw error.message)
- Supabase queries use `getServiceSupabase()` for server-side operations
- Dates stored in UTC, displayed in user's timezone
- All tables use `created_at` and `updated_at` timestamps
- Event slugs must be unique (enforced by DB constraint) - use `/api/events/check-slug` to validate before creation

## UX Patterns

### Round-Robin & Collective Events
- **No single host:** For round-robin and collective meeting types, do NOT show host name/email fields - the host is assigned dynamically at booking time based on availability and distribution strategy
- **Maximum coverage:** Round-robin shows ALL time slots where ANY team member is available - the distribution strategy only affects WHO gets assigned, not how many slots appear
- **Recommended strategy:** "Load Balanced" (least_bookings) for most use cases - fair distribution without complexity

### Form Validation
- Validate unique fields (like slugs) in real-time with debounced API checks (400ms)
- Show visual feedback: green check when valid, red X with suggestions when taken
- Disable submit button until validation passes
- Provide clickable alternatives when a value is taken (e.g., slug suggestions)

### Dashboard & Card Design
- **Copy Link is primary action:** Users visit the dashboard most often to grab a booking link - make Copy Link the most prominent button
- **Whole card is clickable:** Don't have competing click targets (chevron AND button) - make the entire card a link
- **Status badges need contrast:** Use borders and bolder colors (green-100/300, amber-100/300, red-100/300) for accessibility
- **Show booking URL inline:** Display the full URL preview (liveschoolhelp.com/book/slug) directly on cards
- **Sticky footers for long forms:** Keep primary actions (Create, Save) visible at all times

### Events Page (Admin Dashboard)
- **Search & Filter:** Debounced search input (300ms) filters events by name or host; meeting type tabs categorize events
- **Grid/List Toggle:** User preference saved to localStorage; grid shows full cards, list is compact rows
- **Host Avatars:** `AvatarStack` component shows overlapping host profile images with "+N" overflow
- **Analytics Snippets:** Each card shows "Last booked: X days ago" and "N total bookings" aggregated from `oh_bookings`
- **Bulk Selection:** Checkboxes on each card; "Select all"/"Deselect all" link; floating action bar with Disable/Enable/Duplicate/Delete
- **Drag-and-Drop Reordering:** Toggle "Reorder" mode to enable; uses `@dnd-kit`; persists to `display_order` column via `/api/events/reorder`
- **Disabled Status Badge:** Gray badge for `is_active=false` events, distinct from active/full states
- **Reorder restriction:** Drag-and-drop only enabled when no filters are active (all events visible)
- **Dimmed inactive cards:** Events with `is_active=false` or webinars with no slots render at 60% opacity to visually deprioritize them

### Today's Sessions Component
- **Collapsible attendee list:** Show first 3 attendees inline; "View All (N)" button opens modal for sessions with 4+ attendees
- **Prominent Join Meet button:** Large button with video camera icon, shadow, and increased padding (`px-4 py-2.5`) for primary action visibility
- **Reminder status badges:** Pill-style badges with clock icon (24h) and bell icon (1h); green when sent, gray when pending
- **Compact vs expanded:** Sessions with attendees get expanded card view; empty/past sessions get compact single-line rows
- **AttendeeListModal:** Scrollable modal following QRCodeModal pattern with fixed overlay and close button

### Event Settings Page
- **Sidebar navigation:** Left sidebar with section links that highlights active section on scroll (General, Questions, Team Settings, Booking Rules, HubSpot, SMS, etc.)
- **Sticky action bar:** Save/Cancel buttons fixed at bottom of viewport, always visible
- **Live preview panel:** Right panel showing real-time booking page preview that updates as settings change
- **Buffer timeline visualization:** Visual graphic showing meeting duration with buffer blocks, time markers, and legend
- **Priority weight sliders:** 1-10 weight slider with percentage distribution preview bar (not stars)

### Team Member Display
- **Warning badges for connection issues:** Use amber/warning colors when calendar isn't connected
- **Action links near problems:** Add "Connect Calendar" links directly next to users with issues
- **Status indicators on avatars:** Small badge overlays (green check, amber warning) make status scannable

### Calendar/Availability Views
- **White space approach:** Don't label busy blocks with text - use gray backgrounds only. Available times should stand out as clickable purple-tinted cells
- **Simplified legend:** Use "Available" and "Unavailable" rather than verbose descriptions
- **Consolidated actions:** Group slot creation modes (Calendar, Single, Bulk, Recurring, Copy Week, Import) in a dropdown menu rather than tabs
- **Combined availability for co-hosts:** When webinars have co-hosts, show merged availability where ANY host busy = cell unavailable. Show co-host names in legend, not in every cell
- **Empty state CTAs:** When no slots exist, show prominent call-to-action to create the first slot

### Public Booking Page
- **Minimum slots:** Always show at least 2 time slots on initial load - dynamically includes additional days if the first day has fewer slots
- **Progressive disclosure:** Start with limited slots, expand with "Show more days" button
- **Prominent expand button:** "Show more days" is a styled button (not just text link) with count of remaining days
- **Wider content:** Uses 650px max-width for comfortable reading on the main card

### Booking Confirmation Page
- **Large success indicator:** 80x80px checkmark icon in header reinforces successful action
- **Email verification pill:** Display user's email in high-contrast pill (white on green/amber) so they can verify it's correct
- **Reschedule early:** "Made a mistake?" link appears near top of content, not buried at bottom
- **Calendar priority:** Add to Calendar section is prominent with equal-sized buttons for Google, Outlook, and Apple (.ics)
- **Copy over Join:** Primary action is "Copy Meeting Link" (future event), with "Join Now" as secondary button
- **Touch targets:** All buttons minimum 52px height with adequate spacing (12px+) between them
- **Save this link reminder:** Helper text below meeting link reminds user to save it for the session day
- **Contrast ratios:** White text on green (#417762) header meets WCAG AA standards

### Email Templates
- **Modern HTML templates:** Use `generateConfirmationEmailHtml()` and `generateReminderEmailHtml()` from `src/lib/email-html.ts`
- **Unicode emoji for icons:** Gmail and many email clients block SVG data URIs - use Unicode characters (✓, 📅, 🎥, etc.) instead of images
- **Table-based layout:** Use HTML tables for layout, not flexbox/grid - maximum compatibility across email clients
- **Inline styles only:** All CSS must be inline - no `<style>` blocks or external stylesheets
- **Mobile-first:** 44px minimum touch targets, responsive width with max-width constraints
- **Visual hierarchy:** Hero section with confirmation badge, prominent session details with icons
- **Calendar buttons:** Text-based Google, Outlook, Apple buttons linking to their respective calendar URLs
- **Prep checklist:** If prep_materials exist, displayed as checkable items

### Visual Consistency
- **Same action = same color:** Similar interactive elements (e.g., all calendar buttons) should use the same color - brand purple (#6F71EE) for consistency
- **Don't mix brand colors:** Avoid Google blue, Outlook blue, Apple black when they appear side-by-side - unify to brand color or all different
- **Touch targets:** 44px minimum for accessibility on mobile devices

### Slack Notifications
New booking notifications include context for the host to prepare. **Notifications are per-event** - enable them only for events where you want alerts.

**Enabling notifications:**
- Go to event settings → Slack section
- Toggle "Enable Slack Notifications" on
- Configure your Slack webhook in Settings → Integrations

**What's included:**
- Attendee name and email (single-column layout to prevent wrapping)
- First-time vs returning status (from booking history, shown inline with name)
- Date/time in event's timezone with abbreviation (e.g., "3:00 PM CT")
- Relative time indicator ("in 2 days", "tomorrow")
- All booking question responses with their question text as labels

**What's NOT included:**
- Google Meet link (host has it in calendar invitation)
- Organization name (requires slow HubSpot API - may add later via background job)

**Example format:**
```
📅 New Booking: LiveSchool Office Hours

👤 *Laura Litton*  ✨ First session
laura@example.com

🕐 *Friday, Jan 23 at 3:00 PM CT* (in 3 hours)

💬 *What topics are you hoping to cover today?*
>How do I add rewards?
```

**Technical notes:**
- Controlled by `slack_notifications_enabled` on `oh_events` (migration 037)
- Runs synchronously before response to avoid serverless timeout
- Uses `src/lib/slack.ts` `notifyNewBooking()` function
- Question labels come from `event.custom_questions[].question` field
- Timezone comes from `event.timezone` (defaults to America/Chicago)

### What's New Changelog
The app includes a changelog system to communicate new features to users.

**User-facing:**
- Megaphone icon in header with badge showing unseen update count
- `/admin/changelog` page with updates grouped by month
- "New" badges on entries the user hasn't seen yet
- Badge clears automatically when user visits the page

**Adding new entries:**
Edit `src/lib/changelog.ts` and add entries at the TOP of the array:
```typescript
{
  id: '2026-01-24-feature-name',  // unique id
  date: '2026-01-24',              // ISO date
  title: 'Feature Title',
  description: 'Short description.',
  category: 'feature',             // 'feature' | 'improvement' | 'fix'
  details: ['Bullet 1', 'Bullet 2'],  // optional
},
```

**Technical notes:**
- User's last viewed timestamp stored in `oh_admins.last_seen_changelog_at` (migration 038)
- API: `GET /api/changelog` returns entries + unseen status
- API: `POST /api/changelog` marks as seen (updates timestamp)
- Badge in header fetches status on mount (except on changelog page)

## Current State

Working features:
- Full booking flow with multiple meeting types
- Google Calendar 2-way sync
- Round-robin distribution
- Lead routing forms
- SMS reminders (multi-provider)
- HubSpot integration
- Analytics/conversion tracking
- Waitlist management
- Series bookings
- Polls/availability voting
- Event templates (create, edit, apply)
- Per-event Slack notifications
- What's New changelog with badge

See `SCHEDULING_PLATFORM_ROADMAP.md` for detailed feature roadmap.

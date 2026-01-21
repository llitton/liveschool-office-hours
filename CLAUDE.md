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

### Multi-Host
Events can have multiple hosts via `oh_event_hosts` with roles and permissions (`can_manage_slots`, `can_view_bookings`)

## Conventions

- Use server components by default, client components only when needed
- API routes return `{ error: string }` on failure with appropriate status codes
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

See `SCHEDULING_PLATFORM_ROADMAP.md` for detailed feature roadmap.

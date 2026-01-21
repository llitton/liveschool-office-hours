# LiveSchool Scheduling Platform

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
│   └── api/                # API routes (~97 endpoints)
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

## Commands

```bash
npm run dev          # Start dev server (localhost:3000)
npm run build        # Production build
npm run test         # Run tests (Vitest watch)
npm run test:e2e     # Playwright e2e tests
npm run lint         # ESLint
```

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

Host priorities (1-5 stars) are set in `oh_event_hosts.priority` column, configured in event settings.

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

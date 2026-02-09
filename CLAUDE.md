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
│   ├── api/                # API routes (~116 endpoints)
│   └── icon.svg            # Favicon (calendar + checkmark in brand purple)
├── components/             # React components (26 files)
├── lib/                    # Business logic (25 modules)
├── contexts/               # React Context providers
├── hooks/                  # Custom hooks
└── types/                  # TypeScript definitions

migrations/                 # SQL migrations
chrome-extension/           # Browser extension for quick link access
tests/                      # Unit, integration, e2e tests
```

## Admin Navigation Structure

All admin pages are accessible via the main navigation in `src/components/AppShell.tsx`:

```
/admin (Sessions - Today)
├── /admin/past (Past)
├── /admin/one-off (One-off)
└── /admin/polls (Polls) → /new, /[id]

/admin/prepare (Prepare)

/admin/people (People - Team)
└── /admin/people/routing (Routing)
    └── /admin/routing/new, /admin/routing/[id] (Create/Edit forms)

/admin/insights (Insights - Overview)
├── /admin/insights/conversions (Conversions)
├── /admin/analytics (Analytics - word cloud/topics)
└── /admin/team-health (Team Health)

/admin/integrations (Integrations)

/admin/sms (SMS - Dashboard)
└── /admin/sms/logs (Logs)

/admin/settings (Settings - General)
├── /admin/settings/templates (Templates) → /[id]
├── /admin/settings/holidays (Holidays)
└── /admin/system-status (System Status)

Header icons:
├── /admin/changelog (Megaphone icon)
├── /admin/help (? icon)
└── /admin/how-we-built-this (Profile dropdown)

Event pages (accessible from event cards):
├── /admin/events/[id] (Event details)
├── /admin/events/[id]/settings (Event settings)
├── /admin/events/[id]/emails (Email templates)
└── /admin/events/[id]/embed (Embed code)
```

**Navigation rule:** Every admin page must be accessible via navigation or contextual links - no orphaned pages.

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
| Session topics extraction | `src/lib/session-topics.ts` |
| Booking health check | `src/app/api/health/booking/route.ts` |
| Admin add attendee | `src/app/api/slots/[id]/add-attendee/route.ts` |
| Type definitions | `src/types/index.ts` |

## Commands

```bash
npm run dev              # Start dev server (localhost:3000)
npm run build            # Production build
npm run lint             # ESLint
npm run test             # Unit/integration tests (watch)
npm run test -- --run    # Tests once (CI)
npm run test:e2e         # E2E tests
```

## Environment

Copy `.env.local.example` to `.env.local`. Required:
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `NEXT_PUBLIC_APP_URL`

## Branding

| Element | Value | Notes |
|---------|-------|-------|
| **Primary Purple** | `#6F71EE` | Main brand color, buttons, links |
| **Navy** | `#101E57` | Headers, dark text |
| **Green** | `#417762` | Success states, confirmations |
| **Favicon** | `src/app/icon.svg` | Calendar with checkmark in brand purple |

## Key Patterns

### Meeting Types
Six types in `MeetingType` enum: `one_on_one`, `group`, `collective`, `round_robin`, `panel`, `webinar`

### Round-Robin Strategies
Four strategies (enforced by DB CHECK constraint after migration 029):
- `priority` - **Recommended.** Shows all slots, assigns to highest-priority available host
- `least_bookings` - Load balanced, assigns to host with fewest bookings
- `cycle` - Simple rotation A→B→C
- `availability_weighted` - More bookings to hosts with more open time

Host priorities (1-10 weight slider) set in `oh_event_hosts.priority`.

## Conventions

- Use server components by default, client components only when needed
- API routes return `{ error: string }` on failure with appropriate status codes
- Use `getUserFriendlyError()` or `CommonErrors` for error responses (not raw error.message)
- Supabase queries use `getServiceSupabase()` for server-side operations
- **Supabase foreign key joins must use explicit syntax:** `event:oh_events!event_id(*)` not `event:oh_events(*)` — implicit joins silently return null instead of failing
- **Supabase filter paths must use alias names:** Use the alias from the select (e.g., `.eq('slot.event_id', id)` not `.eq('typedSlot.event_id', id)`)
- **Always check Supabase query errors:** Every query must destructure `error` and handle it. Use `const { data, error } = await ...` not `const { data } = await ...`
- **Sent-at timestamp updates must be error-checked:** If the update fails but email succeeded, cron will resend
- **Escape user input in HTML emails:** Use `escapeHtml()` from `src/lib/email-html.ts` on all user-provided strings
- **Escape user input in Slack messages:** Use `escapeSlackMarkdown()` in `src/lib/slack.ts`
- **Batch API limits:** Endpoints accepting arrays must enforce max size (100)
- **Validate host_email:** Must belong to a registered admin in `oh_admins`
- **Booking count queries must filter cancelled:** Any query counting bookings toward capacity must include `.is('cancelled_at', null)` or `.is('bookings.cancelled_at', null)` for aggregate joins — cancelled bookings do NOT count toward slot capacity
- Dates stored in UTC, displayed in user's timezone
- All tables use `created_at` and `updated_at` timestamps
- Event slugs must be unique (enforced by DB constraint)

### URL Handling
All URLs in emails, API responses, and redirects **must** use `NEXT_PUBLIC_APP_URL`:

```typescript
// CORRECT
const url = `${process.env.NEXT_PUBLIC_APP_URL}/book/${slug}`;

// WRONG - never hardcode domains
const url = `https://liveschoolhelp.com/book/${slug}`;
```

- **API routes:** Use `process.env.NEXT_PUBLIC_APP_URL` directly
- **Client components:** Use `process.env.NEXT_PUBLIC_APP_URL || window.location.origin`
- **Never hardcode domains** even as fallbacks

## Current State

Working features: Full booking flow with multiple meeting types, Google Calendar 2-way sync, round-robin distribution, lead routing forms, SMS reminders (multi-provider), HubSpot integration, analytics/conversion tracking, waitlist management, series bookings, polls/availability voting, event templates, per-event Slack notifications, changelog with badge, system status dashboard, user feedback collection, booking health monitoring, admin attendee management (add/remove from any session).

See `SCHEDULING_PLATFORM_ROADMAP.md` for detailed feature roadmap.

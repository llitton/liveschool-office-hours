# LiveSchool Scheduling Platform - Feature Roadmap

> **Last Updated:** January 2026

## Status: Feature Complete 🎉

The scheduling platform has all the features needed for daily use. This roadmap documents what's been built and potential future additions if needs change.

---

## What We Built ✅

### Core Scheduling
- **Meeting Types:** One-on-one, group, collective, round-robin, panel, webinar
- **Booking Constraints:** Min notice, daily/weekly limits, booking window, buffers, approval workflow
- **Timezone Support:** Auto-detect, manual selection, per-event defaults, timezone in emails
- **Calendar UI:** Week/month views, time slot picker, mobile-optimized

### Team Scheduling
- **Round-Robin Distribution:** 4 strategies (priority, least_bookings, cycle, availability_weighted)
- **Multi-Host Support:** Owner/host/backup roles with permissions
- **Collective Scheduling:** Find times when all hosts are free
- **Team Invitations:** Polished emails, status tracking, resend capability

### Lead Routing
- **Routing Forms:** Conditional rules and field mapping
- **Visual Rule Builder:** Drag-and-drop conditions
- **Embeddable Widgets:** `/embed/[slug]` for external sites
- **Conversion Tracking:** Track form → booking funnel

### Integrations
- **Google Calendar:** 2-way sync, Meet links, auto-attendance from Meet
- **HubSpot:** Contacts, companies, deals, meeting types, portal sync
- **Slack:** Per-event notifications with full context, wrap-up summaries
- **SMS:** Multi-provider support (Aircall, Twilio, MessageBird)

### Communications
- **Email Templates:** Confirmation, reminder, cancellation, follow-up, feedback, recording (all styled HTML)
- **Live Email Preview:** Side-by-side editor with instant preview
- **SMS Reminders:** 24h and 1h before with delivery tracking
- **Per-Session Controls:** Skip automated emails for specific sessions

### Attendee Experience
- **Custom Questions:** Text, textarea, phone, radio, checkbox, select types
- **Self-Service:** Reschedule/cancel via manage links
- **Waitlist Management:** Queue position, auto-notification
- **Polls/Voting:** Availability polls for group scheduling

### Analytics & Insights
- **Conversion Tracking:** Page views → slot views → bookings
- **Attendance Rates:** By event, host, time period
- **Topic Analysis:** Word cloud and trending topics
- **Team Health:** Host utilization and distribution
- **Feedback Collection:** Star ratings, comments, topic suggestions

### Admin Tools
- **Event Templates:** Save/apply full configurations
- **Session Wrap-Up:** Attendance tracking, recording/deck links, follow-up emails
- **System Status Dashboard:** Integration health monitoring
- **Changelog:** In-app "What's New" with badge notifications

### Performance
- **Optimized Queries:** Parallel API calls, query caching, payload optimization
- **Fast Page Loads:** Date filtering, column selection, early returns

---

## Not Building (Intentionally Simple)

These features were considered but intentionally skipped to keep the UI simple:

- ~~Workflow Engine~~ - Visual automation builder (overkill for current needs)
- ~~Webhooks~~ - External event notifications (not needed)
- ~~Role-Based Permissions~~ - Granular access control (team is small)
- ~~Audit Logs~~ - Admin action tracking (not required)
- ~~Custom Branding~~ - Logo, colors, fonts per event (current branding works)
- ~~Custom Domains~~ - book.yourcompany.com (not needed)
- ~~AI Features~~ - Prep notes, summaries, clustering (manual works fine)
- ~~Custom Reports~~ - Saved report builder (current analytics sufficient)
- ~~SSO/SAML~~ - Enterprise single sign-on (not needed)
- ~~API Keys~~ - External API access (not needed)
- ~~Multi-Language~~ - Internationalization (English only)
- ~~Recurring Availability~~ - Auto-generate patterns (manual setup works)
- ~~Sequential Booking~~ - Back-to-back with different people (not needed)
- ~~Account-Based Routing~~ - Route by company domain (not needed)

---

## Maybe Someday

Low-priority items that could be added if specific needs arise:

| Feature | Why It Might Be Useful |
|---------|----------------------|
| Team Booking Pages | `/team/[slug]` showing all team events |
| Lead Scoring | Points-based qualification |
| Two-Way SMS | Reply to cancel/reschedule |
| Series Templates | Pre-defined multi-session programs |
| Outcome Tracking | Resolution rates and time-to-resolve |

---

## Technical Notes

### Database
- All tables prefixed with `oh_`
- Row Level Security (RLS) enabled on all tables
- 44 migrations applied

### Testing
- 587 automated tests (Vitest + Playwright)
- Covers auth, email, validation, routing, SMS, Slack, booking logic

### Performance Optimizations (Jan 2026)
- Parallel HubSpot requests with 3-second timeout
- Eliminated N+1 queries in round-robin availability
- Dashboard queries optimized with targeted filters
- API payloads reduced via column selection
- In-memory caching for batch context

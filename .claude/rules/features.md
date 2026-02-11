# Feature Documentation

## Event Templates
Templates capture a complete event configuration for quick reuse. Stored in `oh_session_templates` table.

**What templates capture:**
- Meeting type, duration, max attendees, booking rules, buffer times, timezone settings
- Guest settings, email templates, SMS templates, waitlist settings
- Custom questions, prep materials, banner image, subtitle
- "Allow Any Time" setting (ignore_busy_blocks), Slack notification preference

**Creating/applying templates:**
- From event settings: "Save as Template" captures all current settings
- On new event page, "Quick Start" section shows available templates
- Clicking a template applies ALL fields; auto-generates unique slug
- Host name/email NOT copied (assigned dynamically)

**APIs:**
- `GET/POST /api/session-templates` - List/create templates
- `GET/PUT/DELETE /api/session-templates/[id]` - Single template CRUD
- `POST /api/events/[id]/save-as-template` - Save event as template
- `GET /api/events/check-slug?slug=xxx` - Check slug availability

## HubSpot Integration

### Meeting Types
Events can be mapped to HubSpot meeting types (`hs_activity_type`) for tracking:
- Fetch via `GET /api/hubspot/meeting-types`
- Set `hubspot_meeting_type` on `oh_events` (migration 030)

### Contact Card
Shows HubSpot data and "View in HubSpot" link.
- URL: `https://app.hubspot.com/contacts/{portalId}/record/0-1/{contactId}`
- `portalId` comes from `oh_hubspot_config.portal_id` (database, NOT env var)
- Self-healing: `getHubSpotConfig()` auto-fetches missing portal_id
- Files: `src/components/HubSpotContactCard.tsx`, `src/lib/hubspot.ts`

**Troubleshooting "No company or deal":** Likely missing OAuth scopes. Have user disconnect and reconnect HubSpot.

### Attendee Roles
Categorized by HubSpot `user_type` field (Teacher, Administrator, Site Leader).
- Badge colors: Purple=Administrator, Amber=Site Leader, Blue=Teacher, Gray=Other
- APIs: `POST /api/attendees/batch-context` (primary), `POST /api/attendees/batch-types` (lightweight)
- Batch pre-fetching on attendee list expand for instant context display

## Booking Flow
1. Public page loads event config
2. Client calculates available slots (availability patterns - busy blocks - buffers)
3. Attendee selects slot, fills form
4. POST `/api/bookings` creates booking
5. Syncs to Google Calendar, sends confirmation email

### Round-Robin Dynamic Slot Booking
For round-robin events with dynamic slots, host selection happens **early** in the booking flow (before calendar event creation):
- `selectNextHost()` is called during dynamic slot creation to pick an available host
- The availability check runs against all participating hosts via `selectNextHost`, not just the primary host
- The Google Calendar event is created on the **assigned host's** calendar
- Preferred host from routing forms is respected if specified
- The later round-robin assignment block is skipped via `!assignedHost` guard
- This ensures slots shown as available (because ANY host is free) can always be booked

### Rescheduling
Attendees reschedule via `GET/PUT /api/manage/[token]`:
- GET returns booking details + dynamically generated available slots (same availability engine as booking page)
- PUT moves the booking to a new slot; creates `oh_slots` row on-the-fly for dynamic slots (`dynamic-<ISO>` IDs)
- Dynamic slots get a new Google Calendar event; attendee is removed from old calendar event
- **Old slot auto-cleanup:** After reschedule, if old slot has zero remaining bookings, its calendar event and `oh_slots` row are deleted
- Webinar events still use pre-created slots only
- Reschedule confirmation email sent via host's Google credentials

### Empty Slot Cleanup
Both cancellation (`DELETE /api/manage/[token]`) and reschedule (`PUT /api/manage/[token]`) auto-clean empty slots:
- After the booking is cancelled/moved, checks if the slot has zero remaining active bookings
- If empty: deletes the Google Calendar event and the `oh_slots` row
- Prevents orphaned calendar events from cluttering host calendars
- Webinar slots are exempt (pre-created, may be reused)

## Custom Questions
Events have custom questions via `custom_questions` JSON field on `oh_events`.

**Question types** (`QuestionType` in `src/types/index.ts`):
- `text`, `textarea`, `phone`, `radio`, `checkbox`, `select`
- Types with options: `radio`, `checkbox`, `select` require an `options` array
- Checkbox: stored as comma-separated string

## Allow Any Time (Internal Booking Links)
Bypasses availability patterns AND Google Calendar conflict checks:
- Generates slots from 6am-10pm every day
- Company holidays still block; existing slot conflicts still prevented
- Stored as `ignore_busy_blocks` boolean on `oh_events` (migration 032)

## Google Calendar Integration
- **Event titles:** Use event name directly (no prefix)
- **Co-host invitations:** Webinars=all roles; Collective=owner+host only
- **Attendee invitations:** Added as attendee to existing calendar event
- **Manage link in description:** After adding an attendee, calendar event description is updated with a reschedule/cancel link (one-on-one: direct manage URL; group: points to confirmation email; webinars excluded). Uses `updateCalendarEventDescription()` with `sendUpdates: 'none'`.
- **Retroactive fixes:** `POST /api/slots/add-cohosts` with `{"event_id": "..."}`

### Google Disconnect & Reconnect
Users can disconnect/reconnect from Settings or Integrations to re-authorize with updated OAuth scopes.

**OAuth scopes** (in `src/lib/google.ts`):
- `calendar`, `calendar.events`, `gmail.send`, `userinfo.email`, `userinfo.profile`, `meetings.space.readonly`

**Google Meet REST API** must be enabled in Google Cloud Console for auto-attendance.

## Multi-Host
Events can have multiple hosts via `oh_event_hosts` with roles:
- **owner:** Primary host, full permissions
- **host:** Participating, included in round-robin/collective
- **backup:** Calendar invitations for webinars only

## Team Member Invitations
Managed at People > Team (`/admin/people`):
- Creates `oh_admins` record immediately, sends invitation via Gmail
- Status: Active (green) = Google connected; Pending (amber) = waiting
- Resend: `POST /api/admin/team/[id]/resend-invite`
- Files: `src/app/admin/people/page.tsx`, `src/app/api/admin/team/route.ts`

## Admin Attendee Management
Admins can add or remove attendees from any session (including past/ongoing) directly from the SlotCard attendee list.

**Add Attendee:** "+ Add Attendee" link in attendee section opens inline form (first name, last name, email). Skips public booking constraints (min notice, booking window). Admin chooses whether to send confirmation email.

**Remove Attendee:** Trash icon on each attendee row permanently deletes the booking. Admin chooses whether to send cancellation email. Google Calendar updated automatically in both cases.

**APIs:**
- `POST /api/slots/[id]/add-attendee` — admin-only, uses `create_booking_atomic` RPC
- `DELETE /api/bookings/[id]` — admin-only, permanent delete with optional notification

**Files:** `src/app/api/slots/[id]/add-attendee/route.ts`, `src/app/api/bookings/[id]/route.ts`, `src/app/admin/events/[id]/SlotCard.tsx`

## Attendee Feedback
After sessions, attendees provide feedback via email.

**Database columns** (migration 040) on `oh_bookings`:
- `feedback_rating` (1-5), `feedback_comment`, `feedback_topic_suggestion`, `feedback_submitted_at`, `feedback_sent_at`

**Displayed in:** Past Sessions page, Event details (SlotCard), Attendee list

## Session Wrap-Up
Hosts wrap up sessions from event details page after sessions end.

**Modal features:** Attendance tracking, recording/deck/shared links, follow-up emails, Slack summary

**Session resources** (migration 041): `deck_link`, `shared_links` (JSONB array)

**Follow-up emails:** Sent from current user's Google credentials. Includes resources if added.

**Email tracking** (migration 042): `followup_sent_at`, `no_show_email_sent_at`, `feedback_sent_at` - prevents duplicate automated sends.

**Automated emails toggle** (migration 043): `automated_emails_enabled` on `oh_events` - disables all automated post-session emails when false.

**Per-slot toggle** (migration 044): `skip_automated_emails` on `oh_slots` - skips automated emails for one session.

**Auto-attendance from Google Meet:** Cron at `/api/cron/auto-attendance` runs hourly, syncs Meet data 30-90 min after sessions.

**Wrap-up APIs:**
- `POST /api/slots/[id]/wrap-up-summary` - Slack summary
- `POST /api/slots/[id]/send-followup` - Follow-up emails
- `PATCH /api/slots/[id]` - Update resources

## Changelog
Megaphone icon in header with unseen badge. Edit `src/lib/changelog.ts` to add entries at TOP of array:
```typescript
{
  id: '2026-01-24-feature-name',
  date: '2026-01-24',
  title: 'Feature Title',
  description: 'Short description.',
  category: 'feature',  // 'feature' | 'improvement' | 'fix'
  details: ['Bullet 1'],
},
```
- Timestamp stored in `oh_admins.last_seen_changelog_at` (migration 038)
- APIs: `GET /api/changelog`, `POST /api/changelog`

## User Feedback
Chat bubble icon in header. Modal with Bug/Suggestion/Question category.

**Database:** `oh_user_feedback` table (migration 045)
**Slack:** Separate webhook (`feedback_webhook_url` on `oh_slack_config`, migration 046)
**APIs:** `POST /api/user-feedback`, `POST /api/slack/feedback-webhook`, `GET /api/slack/status`
**Files:** `src/components/FeedbackModal.tsx`, `src/components/AppShell.tsx`

## Slack Notifications
Per-event booking notifications. Enable in event settings > Slack section.

**Includes:** Attendee name/email, first-time vs returning, date/time with timezone, question responses
**Technical:** `slack_notifications_enabled` on `oh_events` (migration 037), runs synchronously

## System Status Dashboard
`/admin/system-status` - monitors database, environment, Google Calendar, HubSpot, Slack, SMS, events, bookings.
- Auto-refreshes every 60 seconds
- API: `GET /api/admin/system-status`

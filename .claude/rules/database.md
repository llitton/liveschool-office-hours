# Database (Supabase)

## Tables

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

## Row Level Security (RLS)

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

## Column Naming Conventions

**IMPORTANT:** The `oh_bookings` table uses specific column names that differ from computed field names used in API responses and external integrations:

| Database Column | Computed/API Field | Notes |
|-----------------|-------------------|-------|
| `first_name` | `attendee_name` | Concatenate: `${first_name} ${last_name}` |
| `last_name` | (part of attendee_name) | |
| `email` | `attendee_email` | Same value, different name |

**When querying `oh_bookings`:**
```typescript
// CORRECT - use actual database columns
.select('first_name, last_name, email')
.eq('email', userEmail)

// WRONG - these columns don't exist
.select('attendee_name, attendee_email')  // Will cause 500 error
.eq('attendee_email', userEmail)           // Will fail silently (no matches)
```

**When passing to external integrations (Slack, HubSpot):**
```typescript
// Construct attendee_name for API payloads
const payload = {
  attendee_name: `${booking.first_name} ${booking.last_name}`.trim(),
  attendee_email: booking.email,
};
```

**Other tables with `attendee_email` column:** `oh_attendee_notes`, `oh_booking_series` - these DO have an `attendee_email` column.

## Database Constraints (Migration 034)

CHECK constraints prevent invalid data at the database level:
- `oh_slots`: start_time must be before end_time
- `oh_events`: duration 1-480 minutes, positive max_attendees, non-negative buffers

## Migration Verification

To verify all database migrations have been applied:

```
GET /api/admin/verify-migrations
```

If migrations are missing, run the corresponding SQL files from `migrations/` in the Supabase SQL Editor. Migration files are numbered (002-043) and should be run in order.

**Migration categories:**
| Range | Purpose |
|-------|---------|
| 002-005 | Core tables (availability, hosts, round-robin) |
| 006, 031 | Row Level Security (RLS) policies |
| 007-011 | Features (routing, SMS, no-show, tasks) |
| 012-013 | Resource tracking, HubSpot sync |
| 014-019 | Waitlist, templates, polls |
| 020-030 | Booking features (time increments, guest emails, analytics) |
| 032-035 | Structural (constraints, atomic booking function) |
| 036-040 | UI features (display order, Slack, changelog, feedback) |
| 041-044 | Session resources, email tracking, auto-emails toggle, per-slot email skip |

**Structural migrations (034, 035):** These add CHECK constraints and stored functions. The verify endpoint confirms the affected tables exist, but you should manually verify these were run if you see database constraint errors.

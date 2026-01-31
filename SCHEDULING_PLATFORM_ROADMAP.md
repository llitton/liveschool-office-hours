# LiveSchool Scheduling Platform - Full Feature Roadmap

> **Last Updated:** January 2026

## Progress Summary

| Category | Complete | Partial | Not Started |
|----------|----------|---------|-------------|
| Phase 1: Core Foundation | 4/4 | 0 | 0 |
| Phase 2: Team Scheduling | 2/3 | 1 | 0 |
| Phase 3: Lead Routing | 2/4 | 1 | 1 |
| Phase 4: Attendee Experience | 1/5 | 1 | 3 |
| Phase 5: Automation | 1/3 | 0 | 2 |
| Phase 6: Analytics | 1/2 | 0 | 1 |
| Phase 7: Enterprise | 0/5 | 0 | 5 |
| Phase 8: Power Features | 1/4 | 2 | 1 |
| **Total** | **12/30** | **5** | **13** |

**Overall Progress: ~57% complete** (counting partial as 0.5)

---

## Vision
Transform the Office Hours scheduling tool into a complete scheduling platform that replaces Calendly and HubSpot Scheduler, with advanced lead routing capabilities similar to Chili Piper.

---

## Current State Summary

### What We Have ✅
- **Meeting Types:** One-on-one, group, collective, round-robin, panel, webinar
- **Round-Robin Distribution:** 4 strategies (priority, least_bookings, cycle, availability_weighted)
- **Multi-Host Support:** Owner/host/backup roles with permissions
- **Booking Constraints:** Min notice, daily/weekly limits, booking window, buffers, approval workflow
- **Lead Routing:** Routing forms with conditional rules and field mapping
- **Google Calendar:** 2-way sync, Meet links, auto-attendance from Meet
- **HubSpot Integration:** Contacts, companies, deals, meeting types, portal sync
- **Slack Notifications:** Per-event notifications with full context
- **SMS Reminders:** Multi-provider (Aircall, Twilio, MessageBird)
- **Email Templates:** Confirmation, reminder, cancellation, follow-up, feedback, recording (all styled HTML)
- **Embeddable Widgets:** `/embed/[slug]` for external sites
- **Custom Questions:** Text, textarea, phone, radio, checkbox, select types
- **Attendee Self-Service:** Reschedule/cancel via manage links
- **Timezone Support:** Auto-detect, manual selection, per-event defaults
- **Analytics:** Conversion tracking, attendance rates, topic analysis, team health
- **Waitlist Management:** Queue position, auto-notification
- **Polls/Voting:** Availability polls for group scheduling
- **Event Templates:** Save/apply full event configurations
- **Session Wrap-Up:** Attendance tracking, recording/deck links, follow-up emails
- **Attendee Feedback:** Star ratings, comments, topic suggestions
- **System Status Dashboard:** Integration health monitoring
- **Changelog:** In-app "What's New" with badge notifications

### What We're Missing 🚧
- **Workflow Engine** - Visual automation builder for multi-step sequences
- **Webhook System** - External event notifications with retry logic
- **Role-Based Permissions** - Granular admin access control
- **Audit Logs** - Admin action tracking for compliance
- **Custom Branding** - Logo, colors, fonts per event/team
- **Custom Domains** - book.yourcompany.com support
- **AI Features** - Prep notes, session summaries, topic clustering
- **Custom Reports** - Saved report builder with scheduling
- **SSO/SAML** - Enterprise single sign-on
- **API Keys** - External API access with rate limiting
- **Multi-Language** - Internationalization support

---

## Phase 1: Core Scheduling Foundation
**Goal:** Fill critical gaps in basic scheduling functionality

### 1.1 Booking Constraints & Limits

#### Database Changes
```sql
-- Add to oh_events table
ALTER TABLE oh_events ADD COLUMN min_notice_hours INTEGER DEFAULT 24;
ALTER TABLE oh_events ADD COLUMN max_daily_bookings INTEGER;
ALTER TABLE oh_events ADD COLUMN max_weekly_bookings INTEGER;
ALTER TABLE oh_events ADD COLUMN booking_window_days INTEGER DEFAULT 60;
ALTER TABLE oh_events ADD COLUMN require_approval BOOLEAN DEFAULT false;

-- Add to oh_admins for personal limits
ALTER TABLE oh_admins ADD COLUMN max_meetings_per_day INTEGER DEFAULT 8;
ALTER TABLE oh_admins ADD COLUMN max_meetings_per_week INTEGER DEFAULT 30;
ALTER TABLE oh_admins ADD COLUMN default_buffer_before INTEGER DEFAULT 0;
ALTER TABLE oh_admins ADD COLUMN default_buffer_after INTEGER DEFAULT 15;
```

#### Features
- [x] **Minimum Notice** - Can't book within X hours (e.g., no same-day bookings)
- [x] **Booking Window** - Only show slots within next X days
- [x] **Daily Limits** - Max meetings per day per host
- [x] **Weekly Limits** - Max meetings per week per host
- [x] **Buffer Time** - Auto-add padding before/after meetings
- [x] **Approval Workflow** - Optional admin approval before confirmation

#### Files to Create/Modify
- `src/lib/booking-constraints.ts` - Validation logic
- `src/app/admin/events/[id]/settings/page.tsx` - Add settings UI
- `src/app/api/bookings/route.ts` - Add constraint checks
- `src/lib/availability.ts` - Factor in buffers and limits

---

### 1.2 Meeting Types

#### Database Changes
```sql
-- New meeting_type enum
CREATE TYPE meeting_type AS ENUM (
  'one_on_one',      -- Single host, single attendee
  'group',           -- Single host, multiple attendees (current office hours)
  'collective',      -- Multiple hosts must all be free, single attendee
  'round_robin',     -- Rotate through team members
  'panel'            -- Multiple hosts, single attendee (like collective but different UX)
);

ALTER TABLE oh_events ADD COLUMN meeting_type meeting_type DEFAULT 'group';
ALTER TABLE oh_events ADD COLUMN allow_guests BOOLEAN DEFAULT false;
ALTER TABLE oh_events ADD COLUMN guest_limit INTEGER DEFAULT 0;
```

#### Features
- [x] **One-on-One** - Classic 1:1 meeting (Calendly default)
- [x] **Group Sessions** - Current office hours behavior
- [x] **Collective** - All selected hosts must be available
- [x] **Round-Robin** - Distribute across team (see Phase 2)
- [x] **Panel** - Multiple hosts interview one attendee
- [x] **Webinar** - Large group sessions with multiple co-hosts
- [x] **Guest Support** - Allow attendees to add +1, +2, etc.

#### Files to Create/Modify
- `src/types/index.ts` - Add MeetingType enum
- `src/app/admin/events/new/page.tsx` - Meeting type selector
- `src/app/book/[slug]/page.tsx` - Adjust UI per type
- `src/lib/availability.ts` - Collective availability calculation

---

### 1.3 Timezone Support

#### Database Changes
```sql
ALTER TABLE oh_events ADD COLUMN display_timezone VARCHAR(50) DEFAULT 'America/New_York';
ALTER TABLE oh_events ADD COLUMN lock_timezone BOOLEAN DEFAULT false;

ALTER TABLE oh_bookings ADD COLUMN attendee_timezone VARCHAR(50);
```

#### Features
- [x] **Auto-detect Timezone** - Detect attendee's timezone via browser
- [x] **Timezone Selector** - Let attendees choose their timezone
- [x] **Lock Timezone** - Force display in event's timezone
- [x] **Timezone in Emails** - Show time in attendee's local timezone
- [x] **Admin Timezone Settings** - Per-admin timezone preferences

#### Files to Create/Modify
- `src/lib/timezone.ts` - Timezone utilities
- `src/app/book/[slug]/page.tsx` - Timezone picker
- `src/lib/email-templates.ts` - Timezone-aware formatting
- `src/components/TimezoneSelector.tsx` - Reusable component

---

### 1.4 Enhanced Calendar UI

#### Features
- [x] **Week View** - See full week of availability
- [x] **Month View** - Calendar month picker
- [x] **Time Slot Grid** - Visual time picker (like Calendly)
- [x] **Mobile-Optimized** - Touch-friendly slot selection
- [x] **Loading States** - Skeleton loaders during fetch

#### Files to Create
- `src/components/booking/WeekView.tsx`
- `src/components/booking/MonthView.tsx`
- `src/components/booking/TimeSlotPicker.tsx`
- `src/components/booking/CalendarNavigation.tsx`

---

## Phase 2: Team Scheduling & Round-Robin
**Goal:** Enable team-based scheduling with intelligent distribution

### 2.1 Round-Robin Engine

#### Database Changes
```sql
-- Round-robin configuration per event
CREATE TABLE oh_round_robin_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID REFERENCES oh_events(id) ON DELETE CASCADE,
  algorithm VARCHAR(20) DEFAULT 'equal', -- 'equal', 'weighted', 'availability', 'random'
  reset_period VARCHAR(20) DEFAULT 'weekly', -- 'daily', 'weekly', 'monthly', 'never'
  skip_if_busy BOOLEAN DEFAULT true,
  notify_on_assignment BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id)
);

-- Team member weights for weighted round-robin
CREATE TABLE oh_round_robin_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  config_id UUID REFERENCES oh_round_robin_config(id) ON DELETE CASCADE,
  admin_id UUID REFERENCES oh_admins(id) ON DELETE CASCADE,
  weight INTEGER DEFAULT 100, -- 100 = normal, 50 = half, 200 = double
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0, -- Higher = preferred
  UNIQUE(config_id, admin_id)
);

-- Track assignments for fair distribution
CREATE TABLE oh_round_robin_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  config_id UUID REFERENCES oh_round_robin_config(id) ON DELETE CASCADE,
  admin_id UUID REFERENCES oh_admins(id),
  booking_id UUID REFERENCES oh_bookings(id),
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  period_start DATE, -- For reset tracking
  INDEX(config_id, period_start)
);
```

#### Algorithm Options
1. **Equal Distribution** - Strict rotation, everyone gets same count
2. **Weighted** - Some members get more (senior reps, capacity-based)
3. **Availability-First** - Whoever has most open slots
4. **Random** - Random selection from available members
5. **Priority-Based** - Try priority order, fall back if unavailable

#### Features
- [x] **Round-Robin Setup UI** - Configure algorithm, members, weights
- [x] **Assignment Tracking** - Dashboard showing distribution
- [x] **Manual Override** - Reassign booking to different member
- [x] **Skip Logic** - Skip members who are busy/OOO
- [x] **Reset Periods** - Daily/weekly/monthly counter resets
- [x] **Notifications** - Alert member when assigned (via Slack)

#### Files to Create
- `src/lib/round-robin.ts` - Core distribution algorithm
- `src/app/api/round-robin/route.ts` - Configuration API
- `src/app/api/round-robin/assign/route.ts` - Assignment logic
- `src/app/admin/events/[id]/round-robin/page.tsx` - Config UI
- `src/components/RoundRobinConfig.tsx`
- `src/components/RoundRobinStats.tsx`

---

### 2.2 Team Booking Pages

#### Database Changes
```sql
CREATE TABLE oh_teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  logo_url VARCHAR(500),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE oh_team_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID REFERENCES oh_teams(id) ON DELETE CASCADE,
  admin_id UUID REFERENCES oh_admins(id) ON DELETE CASCADE,
  role VARCHAR(20) DEFAULT 'member', -- 'owner', 'admin', 'member'
  display_order INTEGER DEFAULT 0,
  UNIQUE(team_id, admin_id)
);

CREATE TABLE oh_team_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID REFERENCES oh_teams(id) ON DELETE CASCADE,
  event_id UUID REFERENCES oh_events(id) ON DELETE CASCADE,
  display_order INTEGER DEFAULT 0,
  UNIQUE(team_id, event_id)
);
```

#### Features
- [ ] **Team Creation** - Create named teams with members
- [ ] **Team Booking Page** - `/team/[slug]` shows all team events
- [ ] **Member Cards** - Show team members with availability indicators
- [ ] **Team Branding** - Logo, colors, description
- [ ] **Team Analytics** - Aggregate stats across team

#### Files to Create
- `src/app/team/[slug]/page.tsx` - Public team booking page
- `src/app/admin/teams/page.tsx` - Team management
- `src/app/api/teams/route.ts` - Team CRUD
- `src/components/TeamMemberCard.tsx`

---

### 2.3 Collective & Sequential Scheduling

#### Database Changes
```sql
-- For sequential meetings (meet SDR, then AE, then Manager)
CREATE TABLE oh_meeting_sequences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID REFERENCES oh_events(id) ON DELETE CASCADE,
  sequence_order INTEGER NOT NULL,
  admin_id UUID REFERENCES oh_admins(id),
  duration_minutes INTEGER NOT NULL,
  title VARCHAR(255), -- "Initial Call", "Technical Deep Dive", etc.
  is_optional BOOLEAN DEFAULT false,
  gap_minutes INTEGER DEFAULT 0, -- Break between meetings
  UNIQUE(event_id, sequence_order)
);
```

#### Features
- [x] **Collective Availability** - Find times when ALL hosts are free
- [ ] **Sequential Booking** - Book back-to-back meetings with different people
- [ ] **Gap Time** - Configure breaks between sequential meetings
- [ ] **Optional Steps** - Some meetings in sequence can be skipped
- [ ] **Handoff Emails** - Notify next person in sequence

#### Files to Create
- `src/lib/collective-availability.ts` - Multi-calendar intersection
- `src/app/admin/events/[id]/sequence/page.tsx` - Sequence builder
- `src/components/SequentialBookingFlow.tsx`

---

## Phase 3: Lead Routing & Qualification
**Goal:** Chili Piper-style intelligent lead routing

### 3.1 Routing Rules Engine

#### Database Changes
```sql
CREATE TABLE oh_routing_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID REFERENCES oh_events(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  priority INTEGER DEFAULT 0, -- Higher = checked first
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE oh_routing_conditions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rule_id UUID REFERENCES oh_routing_rules(id) ON DELETE CASCADE,
  field VARCHAR(100) NOT NULL, -- 'company_size', 'industry', 'country', 'custom_question_X'
  operator VARCHAR(20) NOT NULL, -- 'equals', 'contains', 'greater_than', 'in', 'not_in'
  value JSONB NOT NULL, -- Can be string, number, or array
  logic VARCHAR(5) DEFAULT 'AND' -- 'AND' or 'OR' with next condition
);

CREATE TABLE oh_routing_actions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rule_id UUID REFERENCES oh_routing_rules(id) ON DELETE CASCADE,
  action_type VARCHAR(50) NOT NULL, -- 'assign_to', 'assign_team', 'round_robin', 'redirect', 'notify'
  action_config JSONB NOT NULL -- { "admin_id": "...", "team_id": "...", etc. }
);
```

#### Condition Fields
- Form fields (custom questions)
- Email domain (@bigcorp.com → Enterprise team)
- Company size (if integrated with enrichment)
- Country/timezone
- UTM parameters
- Referral source
- HubSpot properties (if contact exists)

#### Action Types
- **Assign to Specific Person** - Route to named host
- **Assign to Team** - Route to any available team member
- **Round-Robin** - Use round-robin within team
- **Redirect** - Send to different event entirely
- **Notify** - Send Slack/email alert without changing routing
- **Block** - Don't allow booking (with message)

#### Features
- [x] **Visual Rule Builder** - Drag-and-drop condition builder
- [x] **Rule Testing** - Test rules with sample data
- [x] **Rule Priority** - First matching rule wins
- [x] **Fallback Behavior** - What happens if no rules match
- [ ] **Rule Analytics** - Track which rules fire most

#### Files to Create
- `src/lib/routing-engine.ts` - Rule evaluation logic
- `src/app/admin/events/[id]/routing/page.tsx` - Rule builder UI
- `src/app/api/routing/evaluate/route.ts` - Evaluate rules
- `src/components/routing/RuleBuilder.tsx`
- `src/components/routing/ConditionBuilder.tsx`
- `src/components/routing/ActionSelector.tsx`

---

### 3.2 Lead Qualification

#### Database Changes
```sql
CREATE TABLE oh_qualification_questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID REFERENCES oh_events(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  question_type VARCHAR(20) NOT NULL, -- 'text', 'select', 'multi_select', 'number', 'email', 'phone'
  options JSONB, -- For select/multi_select
  is_required BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  disqualify_values JSONB, -- Values that disqualify (show "not a fit" message)
  score_values JSONB -- Points per answer for lead scoring
);

CREATE TABLE oh_qualification_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID REFERENCES oh_bookings(id),
  total_score INTEGER,
  is_qualified BOOLEAN,
  disqualification_reason TEXT,
  responses JSONB,
  evaluated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Features
- [x] **Qualification Form** - Pre-booking questionnaire (via custom questions)
- [ ] **Lead Scoring** - Points-based qualification
- [ ] **Disqualification** - Automatic "not a fit" with custom message
- [ ] **Conditional Questions** - Show questions based on previous answers
- [ ] **Skip to Booking** - High-score leads skip to calendar
- [ ] **Qualification Analytics** - Track qualification rates

#### Files to Create
- `src/lib/lead-qualification.ts` - Scoring logic
- `src/app/book/[slug]/qualify/page.tsx` - Qualification form
- `src/app/admin/events/[id]/qualification/page.tsx` - Question builder
- `src/components/QualificationForm.tsx`

---

### 3.3 Instant Booking Widget (Concierge)

#### Features
- [x] **Embeddable Form** - JavaScript snippet for any website
- [x] **Inline Calendar** - Show availability within form
- [x] **Form-to-Meeting** - Submit form → immediately book
- [x] **Routing in Widget** - Apply routing rules in real-time
- [x] **Conversion Tracking** - Track form → booking conversion
- [ ] **Customizable Design** - Match host website branding

#### Files to Create
- `src/app/api/widget/config/route.ts` - Widget configuration
- `src/app/api/widget/availability/route.ts` - CORS-enabled availability
- `src/widget/embed.js` - Embeddable script
- `src/widget/styles.css` - Widget styles
- `src/app/admin/events/[id]/widget/page.tsx` - Widget customizer
- `public/widget/loader.js` - CDN-ready loader

#### Widget Embed Code
```html
<script src="https://yourapp.com/widget/loader.js"></script>
<div id="liveschool-booking"
     data-event="store-setup-call"
     data-theme="light"
     data-primary-color="#6F71EE">
</div>
```

---

### 3.4 Account-Based Routing

#### Database Changes
```sql
CREATE TABLE oh_account_owners (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email_domain VARCHAR(255), -- @acme.com
  company_name VARCHAR(255), -- "Acme Corp"
  hubspot_company_id VARCHAR(100),
  owner_admin_id UUID REFERENCES oh_admins(id),
  backup_admin_id UUID REFERENCES oh_admins(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  INDEX(email_domain),
  INDEX(hubspot_company_id)
);
```

#### Features
- [ ] **Domain Matching** - Route @acme.com to their CSM
- [ ] **HubSpot Company Lookup** - Check HubSpot for company owner
- [ ] **Backup Owners** - Fallback if primary unavailable
- [ ] **Owner Import** - Bulk import from HubSpot/CSV
- [ ] **Override Rules** - Account routing takes precedence

#### Files to Create
- `src/lib/account-routing.ts` - Account lookup logic
- `src/app/admin/accounts/page.tsx` - Account management
- `src/app/api/accounts/route.ts` - Account CRUD
- `src/app/api/accounts/import/route.ts` - Bulk import

---

## Phase 4: Attendee Experience
**Goal:** Polish the booking experience to match/exceed Calendly

### 4.1 Custom Branding

#### Database Changes
```sql
CREATE TABLE oh_branding (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_type VARCHAR(20) NOT NULL, -- 'event', 'team', 'global'
  entity_id UUID, -- event_id or team_id, null for global
  logo_url VARCHAR(500),
  favicon_url VARCHAR(500),
  primary_color VARCHAR(7), -- #6F71EE
  secondary_color VARCHAR(7),
  background_color VARCHAR(7),
  text_color VARCHAR(7),
  font_family VARCHAR(100),
  custom_css TEXT,
  hide_powered_by BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(entity_type, entity_id)
);
```

#### Features
- [ ] **Logo Upload** - Custom logo on booking pages
- [ ] **Color Customization** - Primary, secondary, background colors
- [ ] **Font Selection** - Choose from web-safe fonts
- [ ] **Custom CSS** - Advanced styling override
- [ ] **Preview Mode** - See changes before publishing
- [ ] **Hide Branding** - Remove "Powered by" (premium feature)

#### Files to Create
- `src/app/admin/branding/page.tsx` - Branding editor
- `src/components/BrandingEditor.tsx`
- `src/lib/branding.ts` - Apply branding to pages

---

### 4.2 Custom Domains

#### Database Changes
```sql
CREATE TABLE oh_custom_domains (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  domain VARCHAR(255) UNIQUE NOT NULL, -- "book.acme.com"
  entity_type VARCHAR(20) NOT NULL, -- 'event', 'team', 'admin'
  entity_id UUID NOT NULL,
  ssl_status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'active', 'failed'
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Features
- [ ] **Domain Verification** - DNS TXT record verification
- [ ] **SSL Provisioning** - Auto-provision SSL via Let's Encrypt
- [ ] **Subdomain Support** - book.yourcompany.com
- [ ] **Fallback Handling** - Graceful fallback if domain fails

#### Files to Create
- `src/app/admin/domains/page.tsx` - Domain management
- `src/app/api/domains/verify/route.ts` - DNS verification
- `src/lib/custom-domains.ts` - Domain routing logic
- `middleware.ts` - Custom domain routing

---

### 4.3 SMS Notifications (Multi-Provider) ✅

**Status:** Implemented with Aircall, Twilio, and MessageBird support.

#### Features
- [x] **Phone Collection** - Optional/required phone on booking form
- [x] **SMS Opt-in** - TCPA-compliant opt-in checkbox
- [x] **Confirmation SMS** - Send booking confirmation via SMS
- [x] **Reminder SMS** - Send reminder X minutes before (24h and 1h)
- [x] **Cancellation SMS** - Notify of cancellation
- [ ] **Two-Way SMS** - Reply to cancel/reschedule (advanced)

#### Files to Create
- `src/lib/twilio.ts` - Twilio integration
- `src/app/api/sms/send/route.ts` - Send SMS
- `src/app/api/cron/send-sms-reminders/route.ts` - Reminder cron
- `src/app/admin/integrations/sms/page.tsx` - SMS config UI

---

### 4.4 Multi-Language Support

#### Database Changes
```sql
CREATE TABLE oh_translations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_type VARCHAR(20) NOT NULL, -- 'event', 'email_template', 'system'
  entity_id UUID,
  locale VARCHAR(10) NOT NULL, -- 'en', 'es', 'fr', 'de', etc.
  field_name VARCHAR(100) NOT NULL,
  translated_text TEXT NOT NULL,
  UNIQUE(entity_type, entity_id, locale, field_name)
);

ALTER TABLE oh_events ADD COLUMN default_locale VARCHAR(10) DEFAULT 'en';
ALTER TABLE oh_events ADD COLUMN available_locales VARCHAR(10)[] DEFAULT ARRAY['en'];
```

#### Features
- [ ] **Language Selector** - Dropdown on booking page
- [ ] **Auto-Detect** - Use browser language preference
- [ ] **Field Translation** - Translate event name, description, questions
- [ ] **Email Translation** - Translated confirmation/reminder emails
- [ ] **System Strings** - Translate "Book Now", "Cancel", etc.

#### Files to Create
- `src/lib/i18n.ts` - Internationalization utilities
- `src/locales/*.json` - Translation files
- `src/app/admin/events/[id]/translations/page.tsx` - Translation editor
- `src/components/LanguageSelector.tsx`

---

### 4.5 Booking Confirmation Page

#### Database Changes
```sql
ALTER TABLE oh_events ADD COLUMN confirmation_page_type VARCHAR(20) DEFAULT 'default';
-- 'default', 'redirect', 'custom'
ALTER TABLE oh_events ADD COLUMN confirmation_redirect_url VARCHAR(500);
ALTER TABLE oh_events ADD COLUMN confirmation_custom_html TEXT;
ALTER TABLE oh_events ADD COLUMN show_add_to_calendar BOOLEAN DEFAULT true;
ALTER TABLE oh_events ADD COLUMN show_reschedule_link BOOLEAN DEFAULT true;
```

#### Features
- [ ] **Custom Confirmation** - Custom HTML/content after booking
- [ ] **Redirect** - Send to external URL after booking
- [x] **Conversion Tracking** - Fire pixels/scripts on confirmation
- [x] **Next Steps** - Show what happens next
- [ ] **Social Sharing** - Share booking on social media

#### Files to Create
- `src/app/book/[slug]/confirmation/page.tsx` - Confirmation page
- `src/app/admin/events/[id]/confirmation/page.tsx` - Confirmation editor

---

## Phase 5: Automation & Workflows
**Goal:** Build powerful automation capabilities

### 5.1 Workflow Engine

#### Database Changes
```sql
CREATE TABLE oh_workflows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  trigger_type VARCHAR(50) NOT NULL,
  -- 'booking_created', 'booking_cancelled', 'booking_rescheduled',
  -- 'reminder_due', 'no_show', 'feedback_submitted', 'time_based'
  trigger_config JSONB, -- Additional trigger conditions
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE oh_workflow_steps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workflow_id UUID REFERENCES oh_workflows(id) ON DELETE CASCADE,
  step_order INTEGER NOT NULL,
  step_type VARCHAR(50) NOT NULL,
  -- 'send_email', 'send_sms', 'wait', 'condition', 'update_record',
  -- 'create_task', 'notify_slack', 'webhook', 'assign_tag'
  step_config JSONB NOT NULL,
  UNIQUE(workflow_id, step_order)
);

CREATE TABLE oh_workflow_executions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workflow_id UUID REFERENCES oh_workflows(id),
  booking_id UUID REFERENCES oh_bookings(id),
  status VARCHAR(20) DEFAULT 'running', -- 'running', 'completed', 'failed', 'paused'
  current_step INTEGER,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  error_message TEXT
);

CREATE TABLE oh_workflow_step_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  execution_id UUID REFERENCES oh_workflow_executions(id) ON DELETE CASCADE,
  step_id UUID REFERENCES oh_workflow_steps(id),
  status VARCHAR(20), -- 'success', 'failed', 'skipped'
  output JSONB,
  executed_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Trigger Types
- **booking_created** - When new booking is made
- **booking_cancelled** - When booking is cancelled
- **booking_rescheduled** - When booking is rescheduled
- **reminder_due** - X minutes/hours before meeting
- **meeting_ended** - When meeting time passes
- **no_show** - When marked as no-show
- **feedback_submitted** - When feedback is submitted
- **tag_applied** - When specific tag is applied
- **time_based** - At specific time (daily digest, etc.)

#### Step Types
- **send_email** - Send templated email
- **send_sms** - Send SMS (if Twilio configured)
- **wait** - Delay for X minutes/hours/days
- **condition** - Branch based on conditions
- **update_record** - Update booking/contact fields
- **create_task** - Create internal or HubSpot task
- **notify_slack** - Send Slack message
- **webhook** - Call external URL
- **assign_tag** - Add/remove tag

#### Features
- [ ] **Visual Workflow Builder** - Drag-and-drop step builder
- [ ] **Conditional Logic** - If/then branching
- [ ] **Delay Steps** - Wait X time before next step
- [ ] **Email Templates** - Rich email editor in workflows
- [ ] **Variable Substitution** - Use booking data in messages
- [ ] **Execution Logs** - Track workflow runs
- [ ] **Workflow Templates** - Pre-built workflow templates

#### Files to Create
- `src/lib/workflow-engine.ts` - Core execution engine
- `src/app/api/workflows/route.ts` - Workflow CRUD
- `src/app/api/workflows/execute/route.ts` - Trigger workflow
- `src/app/api/cron/process-workflows/route.ts` - Process delayed steps
- `src/app/admin/workflows/page.tsx` - Workflow list
- `src/app/admin/workflows/[id]/page.tsx` - Workflow builder
- `src/components/workflows/WorkflowBuilder.tsx`
- `src/components/workflows/StepEditor.tsx`
- `src/components/workflows/ConditionBuilder.tsx`

---

### 5.2 Reminder Sequences

#### Pre-Built Workflow Templates
```
Default Reminder Sequence:
├── Trigger: booking_created
├── Step 1: Send confirmation email (immediate)
├── Step 2: Wait until 24 hours before
├── Step 3: Send reminder email
├── Step 4: Wait until 1 hour before
├── Step 5: Send final reminder email
└── Step 6: (Optional) Send SMS reminder

No-Show Follow-up:
├── Trigger: no_show
├── Step 1: Wait 30 minutes
├── Step 2: Send "we missed you" email
├── Step 3: Wait 24 hours
├── Step 4: Condition: If no reschedule
├── Step 5: Send reschedule prompt
└── Step 6: Create follow-up task

Post-Meeting Sequence:
├── Trigger: meeting_ended + attended
├── Step 1: Wait 2 hours
├── Step 2: Send follow-up email with notes
├── Step 3: Wait 24 hours
├── Step 4: Send feedback request
├── Step 5: Condition: If rating < 3
└── Step 6: Alert manager via Slack
```

#### Files to Create
- `src/lib/workflow-templates.ts` - Pre-built templates
- `src/app/admin/workflows/templates/page.tsx` - Template gallery

---

### 5.3 Webhook System

#### Database Changes
```sql
CREATE TABLE oh_webhooks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  url VARCHAR(500) NOT NULL,
  secret VARCHAR(100), -- For signature verification
  events VARCHAR(50)[] NOT NULL, -- Array of event types
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE oh_webhook_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  webhook_id UUID REFERENCES oh_webhooks(id) ON DELETE CASCADE,
  event_type VARCHAR(50),
  payload JSONB,
  response_status INTEGER,
  response_body TEXT,
  sent_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Webhook Events
- `booking.created`
- `booking.cancelled`
- `booking.rescheduled`
- `booking.attended`
- `booking.no_show`
- `feedback.submitted`
- `slot.created`
- `slot.cancelled`

#### Features
- [ ] **Webhook Management** - Add/edit/delete webhooks
- [ ] **Event Selection** - Choose which events trigger webhook
- [ ] **Secret Signing** - HMAC signature for security
- [ ] **Retry Logic** - Retry failed webhooks
- [ ] **Webhook Logs** - View history of webhook calls
- [ ] **Test Webhook** - Send test payload

#### Files to Create
- `src/lib/webhooks.ts` - Webhook dispatcher
- `src/app/api/webhooks/route.ts` - Webhook CRUD
- `src/app/admin/integrations/webhooks/page.tsx` - Webhook manager

---

## Phase 6: Analytics & Reporting
**Goal:** Comprehensive analytics for optimization

### 6.1 Enhanced Analytics Dashboard

#### Database Changes
```sql
CREATE TABLE oh_analytics_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type VARCHAR(50) NOT NULL,
  -- 'page_view', 'slot_view', 'booking_started', 'booking_completed',
  -- 'booking_abandoned', 'reschedule', 'cancel'
  event_id UUID, -- Related oh_events.id
  booking_id UUID,
  session_id VARCHAR(100), -- Browser session
  user_agent TEXT,
  referrer VARCHAR(500),
  utm_source VARCHAR(100),
  utm_medium VARCHAR(100),
  utm_campaign VARCHAR(100),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  INDEX(event_type, created_at),
  INDEX(event_id, created_at)
);

CREATE TABLE oh_conversion_funnels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID REFERENCES oh_events(id),
  date DATE NOT NULL,
  page_views INTEGER DEFAULT 0,
  slot_views INTEGER DEFAULT 0,
  bookings_started INTEGER DEFAULT 0,
  bookings_completed INTEGER DEFAULT 0,
  bookings_abandoned INTEGER DEFAULT 0,
  UNIQUE(event_id, date)
);
```

#### Metrics to Track
- **Conversion Funnel**: Page views → Slot views → Form starts → Bookings
- **Booking Sources**: UTM tracking, referrers
- **Time-to-Book**: How long from page load to booking
- **Popular Times**: Which slots get booked most
- **No-Show Rates**: By event, host, time, lead source
- **Feedback Scores**: NPS over time, by event
- **Team Utilization**: Meetings per host, capacity usage
- **Lead Quality**: Qualification scores, conversion by source

#### Features
- [x] **Conversion Funnel** - Visualize booking funnel
- [x] **Source Attribution** - Track where bookings come from (UTM params)
- [x] **Time Analysis** - Popular days/times
- [x] **Host Leaderboard** - Compare host metrics (Team Health)
- [x] **Trend Charts** - Week-over-week, month-over-month
- [ ] **Export to CSV** - Download raw data
- [ ] **Scheduled Reports** - Email weekly/monthly reports

#### Files to Create
- `src/lib/analytics.ts` - Analytics tracking
- `src/app/api/analytics/track/route.ts` - Event tracking endpoint
- `src/app/api/analytics/funnel/route.ts` - Funnel data
- `src/app/api/analytics/sources/route.ts` - Source attribution
- `src/app/admin/analytics/page.tsx` - Enhanced dashboard
- `src/components/analytics/ConversionFunnel.tsx`
- `src/components/analytics/SourceChart.tsx`
- `src/components/analytics/TrendChart.tsx`

---

### 6.2 Custom Reports

#### Database Changes
```sql
CREATE TABLE oh_saved_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  report_type VARCHAR(50) NOT NULL, -- 'bookings', 'attendance', 'feedback', 'team', 'custom'
  filters JSONB, -- Date range, events, hosts, etc.
  columns VARCHAR(100)[], -- Which columns to include
  group_by VARCHAR(100),
  sort_by VARCHAR(100),
  sort_order VARCHAR(4) DEFAULT 'desc',
  created_by UUID REFERENCES oh_admins(id),
  is_shared BOOLEAN DEFAULT false,
  schedule VARCHAR(20), -- 'daily', 'weekly', 'monthly', null
  schedule_recipients TEXT[], -- Email addresses
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Features
- [ ] **Report Builder** - Select metrics, filters, grouping
- [ ] **Save Reports** - Save and re-run reports
- [ ] **Share Reports** - Share with team members
- [ ] **Schedule Reports** - Auto-email on schedule
- [ ] **Export Formats** - CSV, PDF, Excel

#### Files to Create
- `src/app/admin/reports/page.tsx` - Report builder
- `src/app/api/reports/route.ts` - Report generation
- `src/app/api/reports/[id]/export/route.ts` - Export report

---

## Phase 7: Admin & Enterprise Features
**Goal:** Enterprise-ready admin capabilities

### 7.1 Role-Based Permissions

#### Database Changes
```sql
CREATE TABLE oh_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  permissions JSONB NOT NULL,
  is_system BOOLEAN DEFAULT false, -- Built-in roles can't be deleted
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Default roles: 'super_admin', 'admin', 'manager', 'member', 'viewer'

ALTER TABLE oh_admins ADD COLUMN role_id UUID REFERENCES oh_roles(id);
```

#### Permission Structure
```json
{
  "events": {
    "create": true,
    "read": true,
    "update": true,
    "delete": false
  },
  "bookings": {
    "read": true,
    "update": true,
    "delete": false,
    "export": true
  },
  "team": {
    "manage": false,
    "view": true
  },
  "analytics": {
    "view": true,
    "export": false
  },
  "integrations": {
    "manage": false,
    "view": true
  },
  "billing": {
    "manage": false,
    "view": false
  }
}
```

#### Features
- [ ] **Built-in Roles** - Super Admin, Admin, Manager, Member, Viewer
- [ ] **Custom Roles** - Create custom permission sets
- [ ] **Role Assignment** - Assign roles to users
- [ ] **Permission Checks** - Enforce permissions in API/UI
- [ ] **Role Audit** - Track role changes

#### Files to Create
- `src/lib/permissions.ts` - Permission checking
- `src/app/admin/roles/page.tsx` - Role management
- `src/app/api/roles/route.ts` - Role CRUD
- `src/middleware.ts` - Permission enforcement

---

### 7.2 Audit Logs

#### Database Changes
```sql
CREATE TABLE oh_audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id UUID REFERENCES oh_admins(id),
  action VARCHAR(100) NOT NULL,
  -- 'event.created', 'event.updated', 'booking.cancelled', 'settings.changed', etc.
  entity_type VARCHAR(50),
  entity_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  INDEX(admin_id, created_at),
  INDEX(entity_type, entity_id),
  INDEX(action, created_at)
);
```

#### Features
- [ ] **Action Logging** - Log all admin actions
- [ ] **Change Tracking** - Store before/after values
- [ ] **Audit Search** - Filter by user, action, date
- [ ] **Audit Export** - Export for compliance
- [ ] **Retention Policy** - Auto-delete old logs

#### Files to Create
- `src/lib/audit.ts` - Audit logging utility
- `src/app/admin/audit/page.tsx` - Audit log viewer
- `src/app/api/audit/route.ts` - Audit log API

---

### 7.3 SSO/SAML

#### Database Changes
```sql
CREATE TABLE oh_sso_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider VARCHAR(50) NOT NULL, -- 'saml', 'oidc', 'google_workspace', 'microsoft'
  display_name VARCHAR(100),
  is_active BOOLEAN DEFAULT true,
  config JSONB NOT NULL,
  -- For SAML: { entry_point, issuer, cert, callback_url }
  -- For OIDC: { client_id, client_secret, authorization_url, token_url }
  domain_restriction VARCHAR(255), -- Only allow @company.com
  auto_provision BOOLEAN DEFAULT true, -- Auto-create users on first login
  default_role_id UUID REFERENCES oh_roles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE oh_admins ADD COLUMN sso_provider_id UUID REFERENCES oh_sso_config(id);
ALTER TABLE oh_admins ADD COLUMN sso_external_id VARCHAR(255);
```

#### Features
- [ ] **SAML 2.0** - Enterprise SSO via SAML
- [ ] **OIDC** - OpenID Connect support
- [ ] **Google Workspace** - Sign in with Google Workspace
- [ ] **Microsoft Entra** - Sign in with Microsoft
- [ ] **Domain Restriction** - Only allow specific email domains
- [ ] **Auto-Provisioning** - Create users on first SSO login
- [ ] **Just-in-Time Provisioning** - Sync user attributes from IdP

#### Files to Create
- `src/lib/sso.ts` - SSO utilities
- `src/app/api/auth/sso/[provider]/route.ts` - SSO callbacks
- `src/app/admin/settings/sso/page.tsx` - SSO configuration

---

### 7.4 API Access

#### Database Changes
```sql
CREATE TABLE oh_api_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  key_hash VARCHAR(64) NOT NULL, -- SHA-256 hash of key
  key_prefix VARCHAR(10) NOT NULL, -- First 10 chars for identification
  admin_id UUID REFERENCES oh_admins(id),
  permissions JSONB, -- Scoped permissions
  rate_limit INTEGER DEFAULT 1000, -- Requests per hour
  expires_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE oh_api_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  api_key_id UUID REFERENCES oh_api_keys(id),
  endpoint VARCHAR(255),
  method VARCHAR(10),
  status_code INTEGER,
  response_time_ms INTEGER,
  ip_address VARCHAR(45),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  INDEX(api_key_id, created_at)
);
```

#### Features
- [ ] **API Key Generation** - Create scoped API keys
- [ ] **Key Rotation** - Regenerate keys without downtime
- [ ] **Rate Limiting** - Per-key rate limits
- [ ] **Usage Dashboard** - Track API usage
- [ ] **API Documentation** - OpenAPI/Swagger docs
- [ ] **SDKs** - JavaScript, Python SDK packages

#### Files to Create
- `src/lib/api-auth.ts` - API key authentication
- `src/app/api/v1/[...path]/route.ts` - Versioned API
- `src/app/admin/settings/api/page.tsx` - API key management
- `public/api-docs/openapi.yaml` - API documentation

---

### 7.5 White-Labeling

#### Database Changes
```sql
CREATE TABLE oh_white_label_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  app_name VARCHAR(100) DEFAULT 'LiveSchool Scheduling',
  logo_url VARCHAR(500),
  favicon_url VARCHAR(500),
  support_email VARCHAR(255),
  support_url VARCHAR(500),
  terms_url VARCHAR(500),
  privacy_url VARCHAR(500),
  hide_powered_by BOOLEAN DEFAULT false,
  custom_footer_html TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Features
- [ ] **Custom App Name** - Replace "LiveSchool" with custom name
- [ ] **Custom Logo** - App-wide logo replacement
- [ ] **Custom Footer** - Custom footer content
- [ ] **Remove Branding** - Hide "Powered by" everywhere
- [ ] **Custom Support Links** - Point to your support resources

#### Files to Create
- `src/app/admin/settings/white-label/page.tsx` - White-label config
- `src/lib/white-label.ts` - White-label utilities

---

## Phase 8: Hannah-Specific Enhancements
**Goal:** Office hours-specific features for power users

### 8.1 AI-Powered Features

#### Database Changes
```sql
CREATE TABLE oh_ai_summaries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID REFERENCES oh_bookings(id),
  summary_type VARCHAR(50), -- 'prep_notes', 'session_summary', 'topic_cluster'
  content TEXT,
  model_used VARCHAR(50),
  generated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE oh_topic_clusters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID REFERENCES oh_events(id),
  cluster_name VARCHAR(255),
  keywords TEXT[],
  booking_count INTEGER,
  last_updated TIMESTAMPTZ DEFAULT NOW()
);
```

#### Features
- [ ] **AI Prep Notes** - Generate briefing from HubSpot + past sessions
- [ ] **Session Summarization** - Summarize notes post-session
- [ ] **Topic Clustering** - Auto-group similar questions
- [ ] **Suggested Responses** - AI-suggested answers based on past sessions
- [ ] **Content Gap Analysis** - Identify topics needing documentation

#### Files to Create
- `src/lib/ai.ts` - AI integration (Claude API)
- `src/app/api/ai/prep-notes/route.ts` - Generate prep notes
- `src/app/api/ai/summarize/route.ts` - Summarize session
- `src/app/api/ai/topics/route.ts` - Topic clustering

---

### 8.2 Waitlist Management

#### Database Changes
```sql
CREATE TABLE oh_waitlist (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID REFERENCES oh_events(id),
  slot_id UUID REFERENCES oh_slots(id), -- Specific slot or null for any
  email VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  phone VARCHAR(20),
  question_responses JSONB,
  position INTEGER, -- Queue position
  notified_at TIMESTAMPTZ, -- When notified of opening
  expires_at TIMESTAMPTZ, -- Notification expiry
  booked_at TIMESTAMPTZ, -- When converted to booking
  created_at TIMESTAMPTZ DEFAULT NOW(),
  INDEX(event_id, slot_id, position)
);

ALTER TABLE oh_events ADD COLUMN waitlist_enabled BOOLEAN DEFAULT false;
ALTER TABLE oh_events ADD COLUMN waitlist_notification_hours INTEGER DEFAULT 24;
```

#### Features
- [x] **Join Waitlist** - Add to waitlist when slots full
- [x] **Queue Position** - Show position in queue
- [x] **Auto-Notification** - Email when slot opens
- [x] **Time-Limited Booking** - X hours to book before next in line
- [ ] **Waitlist Analytics** - Track waitlist conversion

#### Files to Create
- `src/app/api/waitlist/route.ts` - Waitlist CRUD
- `src/app/api/waitlist/notify/route.ts` - Notify next in line
- `src/app/api/cron/process-waitlist/route.ts` - Process waitlist
- `src/app/book/[slug]/waitlist/page.tsx` - Waitlist signup

---

### 8.3 Session Series

#### Enhance Existing `oh_booking_series`
```sql
-- Add to existing table
ALTER TABLE oh_booking_series ADD COLUMN series_name VARCHAR(255);
ALTER TABLE oh_booking_series ADD COLUMN description TEXT;
ALTER TABLE oh_booking_series ADD COLUMN is_template BOOLEAN DEFAULT false;

CREATE TABLE oh_series_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  total_sessions INTEGER NOT NULL,
  session_titles TEXT[], -- Title for each session
  session_descriptions TEXT[], -- Description for each session
  session_resources UUID[], -- Prep resources for each session
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Features
- [ ] **Series Templates** - Pre-defined multi-session programs
- [ ] **Progress Tracking** - Track progress through series
- [ ] **Series Dashboard** - View all active series
- [ ] **Auto-Scheduling** - Suggest next session times
- [ ] **Series Completion** - Certificate or notification on completion

#### Files to Create
- `src/app/admin/series/page.tsx` - Series management
- `src/app/api/series/templates/route.ts` - Template CRUD
- `src/components/SeriesProgress.tsx`

---

### 8.4 Outcome Tracking

#### Database Changes
```sql
CREATE TABLE oh_outcomes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID REFERENCES oh_bookings(id),
  outcome_type VARCHAR(50), -- 'resolved', 'partially_resolved', 'needs_followup', 'escalated'
  resolution_notes TEXT,
  follow_up_date DATE,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE oh_outcome_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID REFERENCES oh_events(id),
  period_start DATE,
  period_end DATE,
  total_sessions INTEGER,
  resolved_first_session INTEGER, -- Resolved in one session
  resolved_multiple_sessions INTEGER,
  escalated INTEGER,
  avg_sessions_to_resolution DECIMAL(3,1),
  UNIQUE(event_id, period_start, period_end)
);
```

#### Features
- [ ] **Resolution Tracking** - Track if issue was resolved
- [ ] **Time-to-Resolution** - How many sessions to resolve
- [ ] **Resolution Rate** - % resolved in first session
- [ ] **Escalation Tracking** - Track escalated issues
- [ ] **Outcome Dashboard** - Visualize resolution metrics

#### Files to Create
- `src/app/api/outcomes/route.ts` - Outcome tracking
- `src/app/admin/analytics/outcomes/page.tsx` - Outcome dashboard

---

## Implementation Priority Matrix

| Phase | Effort | Impact | Dependencies | Priority | Status |
|-------|--------|--------|--------------|----------|--------|
| 1.1 Booking Constraints | Small | High | None | **P0** | ✅ Done |
| 1.2 Meeting Types | Medium | High | None | **P0** | ✅ Done |
| 1.3 Timezone Support | Medium | High | None | **P0** | ✅ Done |
| 1.4 Calendar UI | Medium | Medium | None | **P1** | ✅ Done |
| 2.1 Round-Robin | Large | High | Meeting Types | **P1** | ✅ Done |
| 2.2 Team Pages | Medium | Medium | None | **P2** | 🚧 Not Started |
| 2.3 Collective/Sequential | Large | Medium | Meeting Types | **P2** | 🔄 Partial |
| 3.1 Routing Rules | Large | High | Round-Robin | **P1** | ✅ Done |
| 3.2 Lead Qualification | Medium | High | None | **P1** | 🔄 Partial |
| 3.3 Embed Widget | Large | High | Routing | **P2** | ✅ Done |
| 3.4 Account Routing | Medium | Medium | Routing | **P2** | 🚧 Not Started |
| 4.1 Custom Branding | Medium | Medium | None | **P2** | 🚧 Not Started |
| 4.2 Custom Domains | Large | Medium | Branding | **P3** | 🚧 Not Started |
| 4.3 SMS (Multi-Provider) | Medium | Medium | None | **P2** | ✅ Done |
| 4.4 Multi-Language | Large | Low | None | **P3** | 🚧 Not Started |
| 4.5 Confirmation Page | Small | Medium | None | **P2** | 🔄 Partial |
| 5.1 Workflow Engine | Large | High | None | **P1** | 🚧 Not Started |
| 5.2 Reminder Sequences | Medium | High | Workflows | **P1** | ✅ Done (via cron) |
| 5.3 Webhooks | Medium | High | None | **P1** | 🚧 Not Started |
| 6.1 Analytics Dashboard | Medium | High | None | **P1** | ✅ Done |
| 6.2 Custom Reports | Medium | Medium | Analytics | **P2** | 🚧 Not Started |
| 7.1 Role Permissions | Medium | High | None | **P1** | 🚧 Not Started |
| 7.2 Audit Logs | Medium | Medium | None | **P2** | 🚧 Not Started |
| 7.3 SSO/SAML | Large | Medium | Permissions | **P3** | 🚧 Not Started |
| 7.4 API Access | Large | Medium | Permissions | **P2** | 🚧 Not Started |
| 7.5 White-Labeling | Small | Low | Branding | **P3** | 🚧 Not Started |
| 8.1 AI Features | Large | High | None | **P2** | 🚧 Not Started |
| 8.2 Waitlist | Medium | Medium | None | **P2** | ✅ Done |
| 8.3 Session Series | Medium | Medium | None | **P2** | 🔄 Partial |
| 8.4 Outcome Tracking | Small | Medium | None | **P2** | 🔄 Partial |

---

## Sprint Plan

### ✅ Completed Sprints

#### Sprint 1-2: Core Foundation (P0) - DONE
- [x] 1.1 Booking Constraints (min notice, limits, buffers)
- [x] 1.2 Meeting Types (one-on-one, collective, round-robin, panel, webinar)
- [x] 1.3 Timezone Support
- [x] 1.4 Enhanced Calendar UI

#### Sprint 3-4: Team & Distribution (P1) - DONE
- [x] 2.1 Round-Robin Engine (4 strategies)
- [x] 3.1 Routing Rules Engine
- [x] 6.1 Analytics Dashboard

#### Sprint 5-6: Attendee Experience (P2) - DONE
- [x] 4.3 SMS Notifications (multi-provider)
- [x] 3.3 Embeddable Widget
- [x] 8.2 Waitlist Management

---

### 🚧 Next Up

#### Sprint 7-8: Automation & Enterprise (P1)
- [ ] 5.1 Workflow Engine - Visual automation builder
- [ ] 5.3 Webhook System - External integrations
- [ ] 7.1 Role-Based Permissions - Admin access control

#### Sprint 9-10: Power Features (P2)
- [ ] 8.1 AI Features (prep notes, session summaries, topic clustering)
- [ ] 4.1 Custom Branding (logo, colors, fonts)
- [ ] 6.2 Custom Reports (saved reports, scheduling)
- [ ] 7.2 Audit Logs

#### Sprint 11-12: Advanced (P2)
- [ ] 2.2 Team Booking Pages
- [ ] 2.3 Sequential Booking (remaining features)
- [ ] 3.4 Account-Based Routing
- [ ] 7.4 API Access

#### Sprint 13-14: Enterprise (P3)
- [ ] 7.3 SSO/SAML
- [ ] 4.2 Custom Domains
- [ ] 4.4 Multi-Language
- [ ] 7.5 White-Labeling

---

## Technical Considerations

### Performance
- Add Redis caching for availability calculations
- Implement database indexing strategy
- Consider read replicas for analytics queries
- Use edge functions for widget embed

### Security
- Implement rate limiting on all public endpoints
- Add CSRF protection
- Encrypt sensitive data at rest
- Regular security audits

### Scalability
- Design for multi-tenant from the start
- Plan database sharding strategy
- Use queue-based processing for workflows
- CDN for static assets and widget

### Monitoring
- Set up error tracking (Sentry)
- Implement performance monitoring
- Create alerting for critical paths
- Build health check endpoints

---

## Success Metrics

### Adoption
- Number of events created
- Number of bookings per month
- Active admins/hosts
- Widget embed installations

### Engagement
- Booking completion rate
- Reschedule vs cancel ratio
- Feedback submission rate
- Average feedback score

### Efficiency
- Average time to book
- No-show rate reduction
- Support ticket volume
- Admin time saved

### Revenue (if applicable)
- Paid meeting revenue
- Conversion rate by source
- Customer lifetime value

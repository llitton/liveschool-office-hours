export interface CustomQuestion {
  id: string;
  question: string;
  type: 'text' | 'textarea' | 'select';
  required: boolean;
  options?: string[]; // For select type
}

// Meeting type enum
export type MeetingType = 'one_on_one' | 'group' | 'collective' | 'round_robin' | 'panel';

export const MEETING_TYPE_LABELS: Record<MeetingType, string> = {
  one_on_one: 'One-on-One',
  group: 'Group Session',
  collective: 'Collective (All Hosts)',
  round_robin: 'Round-Robin',
  panel: 'Panel',
};

export const MEETING_TYPE_DESCRIPTIONS: Record<MeetingType, string> = {
  one_on_one: 'Single host meets with one attendee at a time',
  group: 'Single host meets with multiple attendees (group style)',
  collective: 'All selected hosts must be available for the meeting',
  round_robin: 'Meetings are distributed across team members',
  panel: 'Multiple hosts interview or meet with one attendee',
};

export interface OHEvent {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  host_name: string;
  host_email: string;
  max_attendees: number;
  buffer_before: number;
  buffer_after: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Email templates
  confirmation_subject: string | null;
  confirmation_body: string | null;
  reminder_subject: string | null;
  reminder_body: string | null;
  cancellation_subject: string | null;
  cancellation_body: string | null;
  // Custom questions and prep materials
  custom_questions: CustomQuestion[] | null;
  prep_materials: string | null;
  // Banner image for public booking page
  banner_image: string | null;
  // Meeting type
  meeting_type: MeetingType;
  allow_guests: boolean;
  guest_limit: number;
  // Booking constraints
  min_notice_hours: number;
  max_daily_bookings: number | null;
  max_weekly_bookings: number | null;
  booking_window_days: number;
  require_approval: boolean;
  // Timezone settings
  display_timezone: string;
  lock_timezone: boolean;
  // Round-robin configuration
  round_robin_strategy: 'cycle' | 'least_bookings' | 'availability_weighted' | null;
  round_robin_period: 'day' | 'week' | 'month' | 'all_time';
}

export interface OHSlot {
  id: string;
  event_id: string;
  start_time: string;
  end_time: string;
  google_event_id: string | null;
  google_meet_link: string | null;
  is_cancelled: boolean;
  created_at: string;
  // Recording link for post-session
  recording_link: string | null;
}

export interface OHBooking {
  id: string;
  slot_id: string;
  first_name: string;
  last_name: string;
  email: string;
  confirmation_sent_at: string | null;
  calendar_invite_sent_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  reminder_24h_sent_at: string | null;
  reminder_1h_sent_at: string | null;
  manage_token: string | null;
  question_responses: Record<string, string> | null;
  // Timezone
  attendee_timezone: string | null;
  // No-show tracking
  attended_at: string | null;
  no_show_at: string | null;
  no_show_email_sent_at: string | null;
  // Feedback
  feedback_sent_at: string | null;
  feedback_rating: number | null;
  feedback_comment: string | null;
  feedback_submitted_at: string | null;
  // Recording
  recording_sent_at: string | null;
  // Round-robin assignment
  assigned_host_id: string | null;
}

export interface OHAttendeeNote {
  id: string;
  attendee_email: string;
  admin_email: string;
  note: string;
  created_at: string;
  updated_at: string;
}

export interface OHAdmin {
  id: string;
  email: string;
  name: string | null;
  google_access_token: string | null;
  google_refresh_token: string | null;
  token_expires_at: string | null;
  created_at: string;
  updated_at: string;
  // Personal meeting limits
  max_meetings_per_day: number;
  max_meetings_per_week: number;
  default_buffer_before: number;
  default_buffer_after: number;
  // Profile image URL (stored in Supabase Storage)
  profile_image: string | null;
}

export interface SlotWithBookings extends OHSlot {
  bookings: OHBooking[];
  booking_count: number;
}

export interface EventWithSlots extends OHEvent {
  slots: SlotWithBookings[];
}

// ============================================
// AVAILABILITY MANAGEMENT
// ============================================

export interface OHAvailabilityPattern {
  id: string;
  admin_id: string;
  day_of_week: number; // 0=Sunday, 6=Saturday
  start_time: string; // TIME format HH:mm:ss
  end_time: string;
  timezone: string;
  is_active: boolean;
  created_at: string;
}

export interface OHBusyBlock {
  id: string;
  admin_id: string;
  start_time: string;
  end_time: string;
  source: 'google_calendar' | 'manual';
  external_event_id: string | null;
  synced_at: string;
}

// ============================================
// MULTI-HOST SUPPORT
// ============================================

export interface OHEventHost {
  id: string;
  event_id: string;
  admin_id: string;
  role: 'owner' | 'host' | 'backup';
  can_manage_slots: boolean;
  can_view_bookings: boolean;
  created_at: string;
  // Joined data
  admin?: OHAdmin;
}

// Extended slot with assigned host
export interface OHSlotWithHost extends OHSlot {
  assigned_host_id: string | null;
  assigned_host?: OHAdmin;
}

// ============================================
// SESSION TAGS & QUICK ACTIONS
// ============================================

export interface OHSessionTag {
  id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface OHBookingTag {
  booking_id: string;
  tag_id: string;
  applied_at: string;
  applied_by: string | null;
  // Joined data
  tag?: OHSessionTag;
}

export interface OHQuickTask {
  id: string;
  booking_id: string;
  title: string;
  notes: string | null;
  due_date: string | null;
  completed_at: string | null;
  hubspot_task_id: string | null;
  created_by: string | null;
  created_at: string;
}

// Extended booking with tags and tasks
export interface OHBookingWithExtras extends OHBooking {
  tags?: OHSessionTag[];
  tasks?: OHQuickTask[];
  hubspot_contact_id?: string | null;
  series_id?: string | null;
  series_sequence?: number | null;
  prep_resources_sent?: string[];
}

// ============================================
// SERIES BOOKINGS
// ============================================

export interface OHBookingSeries {
  id: string;
  attendee_email: string;
  event_id: string;
  recurrence_pattern: 'weekly' | 'biweekly' | 'monthly';
  total_sessions: number;
  preferred_day: number | null;
  preferred_time: string | null;
  created_at: string;
  // Joined data
  bookings?: OHBooking[];
}

// ============================================
// INTEGRATIONS
// ============================================

export interface OHHubSpotConfig {
  id: string;
  access_token: string;
  refresh_token: string | null;
  portal_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface OHSlackConfig {
  id: string;
  webhook_url: string;
  default_channel: string | null;
  notify_on_booking: boolean;
  daily_digest: boolean;
  daily_digest_time: string;
  post_session_summary: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================
// PREP RESOURCES
// ============================================

export interface OHPrepResource {
  id: string;
  event_id: string;
  title: string;
  content: string;
  link: string | null;
  keywords: string[];
  is_active: boolean;
  created_at: string;
}

// ============================================
// ANALYTICS
// ============================================

export interface OHEffectivenessMetrics {
  id: string;
  event_id: string | null;
  period_start: string;
  period_end: string;
  total_bookings: number;
  attended_count: number;
  no_show_count: number;
  cancelled_count: number;
  feedback_count: number;
  avg_feedback_rating: number | null;
  resolved_count: number;
  follow_up_count: number;
  escalated_count: number;
  computed_at: string;
}

// ============================================
// ROUND-ROBIN DISTRIBUTION
// ============================================

export type RoundRobinStrategy = 'cycle' | 'least_bookings' | 'availability_weighted';
export type RoundRobinPeriod = 'day' | 'week' | 'month' | 'all_time';

export interface OHRoundRobinState {
  id: string;
  event_id: string;
  last_assigned_host_id: string | null;
  last_assigned_at: string;
  assignment_count: number;
}

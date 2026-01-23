export interface CustomQuestion {
  id: string;
  question: string;
  type: 'text' | 'textarea' | 'select';
  required: boolean;
  options?: string[]; // For select type
}

// Meeting type enum
export type MeetingType = 'one_on_one' | 'group' | 'collective' | 'round_robin' | 'panel' | 'webinar';

export const MEETING_TYPE_LABELS: Record<MeetingType, string> = {
  one_on_one: 'One-on-One',
  group: 'Group Session',
  collective: 'Collective (All Hosts)',
  round_robin: 'Round-Robin',
  panel: 'Panel',
  webinar: 'Webinar',
};

export const MEETING_TYPE_DESCRIPTIONS: Record<MeetingType, string> = {
  one_on_one: 'Single host meets with one attendee at a time',
  group: 'Single host meets with multiple attendees (office hours, trainings)',
  collective: 'All selected hosts must be available for one-on-one meetings',
  round_robin: 'Meetings are distributed across team members',
  panel: 'Multiple hosts interview or meet with one attendee',
  webinar: 'Scheduled sessions with multiple attendees, all co-hosts must be available',
};

// Meeting types that don't need minimum notice (events happen at set times)
export const MEETING_TYPES_NO_MIN_NOTICE: MeetingType[] = ['webinar'];

export interface OHEvent {
  id: string;
  slug: string;
  name: string;
  subtitle: string | null;
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
  // No-show re-engagement emails
  no_show_subject: string | null;
  no_show_body: string | null;
  no_show_emails_enabled: boolean;
  no_show_email_delay_hours: number;
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
  ignore_busy_blocks: boolean;
  // Start time increments (how often slots appear)
  start_time_increment: number;
  // Timezone settings
  display_timezone: string;
  lock_timezone: boolean;
  // Round-robin configuration
  round_robin_strategy: 'cycle' | 'least_bookings' | 'availability_weighted' | null;
  round_robin_period: 'day' | 'week' | 'month' | 'all_time';
  // Host profile image (joined from oh_admins)
  host_profile_image?: string | null;
  // SMS reminders
  sms_reminders_enabled: boolean;
  sms_phone_required: boolean;
  sms_reminder_24h_template: string | null;
  sms_reminder_1h_template: string | null;
  // Phone requirement (independent of SMS)
  phone_required: boolean;
  // Waitlist settings
  waitlist_enabled: boolean;
  waitlist_limit: number | null;
  // One-off meeting settings
  is_one_off: boolean;
  single_use: boolean;
  one_off_expires_at: string | null;
  one_off_booked_at: string | null;
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
  cancellation_reason: string | null;
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
  // SMS reminders
  phone: string | null;
  sms_consent: boolean;
  sms_reminder_24h_sent_at: string | null;
  sms_reminder_1h_sent_at: string | null;
  // Waitlist
  is_waitlisted: boolean;
  waitlist_position: number | null;
  promoted_from_waitlist_at: string | null;
  waitlist_notification_sent_at: string | null;
  // Guest emails
  guest_emails: string[];
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
  // Onboarding progress
  onboarding_progress: OnboardingState | null;
  // Quick links personal token
  quick_links_token: string;
}

// Session Templates for quick event creation
export interface OHSessionTemplate {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  meeting_type: string;
  duration_minutes: number;
  max_attendees: number;
  min_notice_hours: number;
  booking_window_days: number;
  custom_questions: CustomQuestion[];
  prep_materials: string | null;
  is_system: boolean;
  created_at: string;
  updated_at: string;
  // Extended fields
  buffer_before: number;
  buffer_after: number;
  start_time_increment: number;
  require_approval: boolean;
  display_timezone: string | null;
  lock_timezone: boolean;
  allow_guests: boolean;
  guest_limit: number;
  confirmation_subject: string | null;
  confirmation_body: string | null;
  reminder_subject: string | null;
  reminder_body: string | null;
  cancellation_subject: string | null;
  cancellation_body: string | null;
  waitlist_enabled: boolean;
  waitlist_limit: number | null;
  sms_reminders_enabled: boolean;
  sms_phone_required: boolean;
  phone_required: boolean;
  round_robin_strategy: string | null;
  round_robin_period: string | null;
  created_by: string | null;
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
  template_id: string | null;
}

export type TaskTiming = 'before_session' | 'during_session' | 'after_session';

export interface OHTaskTemplate {
  id: string;
  event_id: string;
  title: string;
  description: string | null;
  timing: TaskTiming;
  default_due_offset_hours: number | null;
  auto_create: boolean;
  sync_to_hubspot: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export const TASK_TIMING_LABELS: Record<TaskTiming, string> = {
  before_session: 'Before Session',
  during_session: 'During Session',
  after_session: 'After Session',
};

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
// SMS REMINDERS
// ============================================

export type SMSProvider = 'aircall' | 'twilio' | 'messagebird';

export interface OHSMSConfig {
  id: string;
  provider: SMSProvider;
  api_key: string;
  api_secret: string | null;
  sender_phone: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type SMSMessageType = 'reminder_24h' | 'reminder_1h' | 'test' | 'custom';
export type SMSStatus = 'sent' | 'delivered' | 'failed';

export interface OHSMSLog {
  id: string;
  booking_id: string | null;
  event_id: string | null;
  recipient_phone: string;
  recipient_name: string | null;
  message_type: SMSMessageType;
  message_body: string;
  character_count: number;
  segment_count: number;
  status: SMSStatus;
  provider: SMSProvider;
  provider_message_id: string | null;
  error_message: string | null;
  sent_at: string | null;
  created_at: string;
  // Joined data
  event?: OHEvent;
  booking?: OHBooking;
}

export interface SMSUsageStats {
  period: { start: string; end: string };
  totalSent: number;
  totalDelivered: number;
  totalFailed: number;
  deliveryRate: number;
  totalSegments: number;
  byEvent: Array<{ eventId: string; eventName: string; count: number }>;
  byDay: Array<{ date: string; sent: number; delivered: number; failed: number }>;
  byType: Record<SMSMessageType, number>;
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

export type RoundRobinStrategy = 'cycle' | 'least_bookings' | 'availability_weighted' | 'priority';
export type RoundRobinPeriod = 'day' | 'week' | 'month' | 'all_time';

export interface OHRoundRobinState {
  id: string;
  event_id: string;
  last_assigned_host_id: string | null;
  last_assigned_at: string;
  assignment_count: number;
}

// ============================================
// ROUTING FORMS
// ============================================

export interface RoutingQuestion {
  id: string;
  question: string;
  type: 'text' | 'select' | 'radio';
  required: boolean;
  options?: string[];
}

export interface OHRoutingForm {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  questions: RoutingQuestion[];
  default_event_id: string | null;
  is_active: boolean;
  submission_count: number;
  created_at: string;
  updated_at: string;
  // Joined data
  default_event?: OHEvent;
}

export interface OHRoutingRule {
  id: string;
  routing_form_id: string;
  question_id: string;
  answer_value: string;
  target_event_id: string;
  target_host_id: string | null;
  priority: number;
  is_active: boolean;
  created_at: string;
  // Joined data
  target_event?: OHEvent;
  target_host?: OHAdmin;
}

export interface RoutingFormWithRules extends OHRoutingForm {
  rules: OHRoutingRule[];
}

// ============================================
// USER ONBOARDING
// ============================================

// Note: 'slots' step removed - non-webinar events use dynamic availability
export type OnboardingStep = 'google' | 'event' | 'share';

export interface OnboardingState {
  welcomeSeen: boolean;
  tourCompleted: boolean;
  tourStep: number | null;  // null = not active, number = current step
  checklistDismissed: boolean;
  tooltipsDismissed: string[];  // Array of tooltip IDs
  completedSteps: OnboardingStep[];
}

export const DEFAULT_ONBOARDING_STATE: OnboardingState = {
  welcomeSeen: false,
  tourCompleted: false,
  tourStep: null,
  checklistDismissed: false,
  tooltipsDismissed: [],
  completedSteps: [],
};

// ============================================
// MEETING POLLS
// ============================================

export type PollStatus = 'open' | 'closed' | 'booked';
export type VoteType = 'yes' | 'maybe';

export interface OHPoll {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  host_id: string;
  duration_minutes: number;
  location: string | null;
  show_votes: boolean;
  max_votes_per_person: number | null;
  status: PollStatus;
  closed_at: string | null;
  booked_event_id: string | null;
  booked_slot_id: string | null;
  booked_at: string | null;
  booked_option_id: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  host?: OHAdmin;
  options?: OHPollOption[];
}

export interface OHPollOption {
  id: string;
  poll_id: string;
  start_time: string;
  end_time: string;
  sort_order: number;
  vote_count: number;
  created_at: string;
  // Joined data
  votes?: OHPollVote[];
}

export interface OHPollVote {
  id: string;
  poll_id: string;
  option_id: string;
  voter_name: string;
  voter_email: string;
  vote_type: VoteType;
  created_at: string;
}

// ============================================
// BOOKING ANALYTICS TYPES
// ============================================

export type BookingAnalyticsEventType =
  | 'page_view'
  | 'slot_selection'
  | 'form_start'
  | 'form_submit'
  | 'booking_created'
  | 'booking_failed';

export interface BookingAnalyticsEvent {
  id: string;
  session_id: string;
  event_id: string | null;
  slot_id: string | null;
  booking_id: string | null;
  event_type: BookingAnalyticsEventType;
  event_slug: string | null;
  selected_slot_time: string | null;
  referrer_url: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  device_type: string | null;
  browser_name: string | null;
  visitor_timezone: string | null;
  error_code: string | null;
  error_message: string | null;
  created_at: string;
  event_name: string | null;
}

export interface ConversionFunnelData {
  pageViews: number;
  slotSelections: number;
  formStarts: number;
  formSubmits: number;
  bookingsCreated: number;
  bookingsFailed: number;
}

export interface ConversionStats {
  summary: {
    period: string;
    startDate: string;
    endDate: string;
    totalPageViews: number;
    totalBookings: number;
    overallConversionRate: number;
  };
  funnel: ConversionFunnelData & {
    pageToSlotRate: number;
    slotToFormRate: number;
    formStartToSubmitRate: number;
    submitToBookingRate: number;
  };
  byEvent: Array<{
    eventId: string;
    eventName: string;
    eventSlug: string;
    pageViews: number;
    bookings: number;
    conversionRate: number;
  }>;
  byDay: Array<{
    date: string;
    pageViews: number;
    bookings: number;
    conversionRate: number;
  }>;
  topDropOffs: Array<{
    step: string;
    fromStep: string;
    toStep: string;
    dropOffRate: number;
    sessionsLost: number;
  }>;
  errors: Array<{
    errorCode: string;
    errorMessage: string;
    count: number;
  }>;
}

export interface OHPollInvitee {
  id: string;
  poll_id: string;
  name: string;
  email: string;
  added_at: string;
}

export interface PollWithDetails extends OHPoll {
  options: OHPollOption[];
  total_participants: number;
}

// Attendee calendar integration
export interface BusyTimeBlock {
  start: string; // ISO timestamp
  end: string; // ISO timestamp
}

// ============================================
// COMPANY HOLIDAYS
// ============================================

export interface OHCompanyHoliday {
  id: string;
  date: string;
  name: string;
  created_by: string | null;
  created_at: string;
}

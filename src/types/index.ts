export interface OHEvent {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  host_name: string;
  host_email: string;
  max_attendees: number;
  buffer_minutes: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
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
}

export interface SlotWithBookings extends OHSlot {
  bookings: OHBooking[];
  booking_count: number;
}

export interface EventWithSlots extends OHEvent {
  slots: SlotWithBookings[];
}

import { vi } from 'vitest';
import type { OHEvent, OHSlot, OHBooking, OHAdmin, OHAvailabilityPattern, OHBusyBlock } from '@/types';

// ============================================
// MOCK DATA FACTORIES
// ============================================

export function createMockEvent(overrides: Partial<OHEvent> = {}): OHEvent {
  return {
    id: crypto.randomUUID(),
    slug: 'test-event',
    name: 'Test Event',
    subtitle: null,
    description: null,
    duration_minutes: 30,
    host_name: 'Test Host',
    host_email: 'host@test.com',
    max_attendees: 1,
    buffer_before: 0,
    buffer_after: 0,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    confirmation_subject: null,
    confirmation_body: null,
    reminder_subject: null,
    reminder_body: null,
    cancellation_subject: null,
    cancellation_body: null,
    no_show_subject: null,
    no_show_body: null,
    no_show_emails_enabled: false,
    no_show_email_delay_hours: 24,
    custom_questions: null,
    prep_materials: null,
    banner_image: null,
    meeting_type: 'one_on_one',
    allow_guests: false,
    guest_limit: 0,
    min_notice_hours: 24,
    max_daily_bookings: null,
    max_weekly_bookings: null,
    booking_window_days: 60,
    require_approval: false,
    ignore_busy_blocks: false,
    start_time_increment: 30,
    display_timezone: 'America/New_York',
    lock_timezone: false,
    round_robin_strategy: null,
    round_robin_period: 'week',
    sms_reminders_enabled: false,
    sms_phone_required: false,
    sms_reminder_24h_template: null,
    sms_reminder_1h_template: null,
    phone_required: false,
    waitlist_enabled: false,
    waitlist_limit: null,
    is_one_off: false,
    single_use: false,
    one_off_expires_at: null,
    one_off_booked_at: null,
    slack_notifications_enabled: false,
    ...overrides,
  };
}

export function createMockSlot(overrides: Partial<OHSlot> = {}): OHSlot {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(14, 0, 0, 0);

  const endTime = new Date(tomorrow);
  endTime.setMinutes(endTime.getMinutes() + 30);

  return {
    id: crypto.randomUUID(),
    event_id: crypto.randomUUID(),
    start_time: tomorrow.toISOString(),
    end_time: endTime.toISOString(),
    google_event_id: null,
    google_meet_link: null,
    is_cancelled: false,
    created_at: new Date().toISOString(),
    recording_link: null,
    deck_link: null,
    shared_links: null,
    ...overrides,
  };
}

export function createMockBooking(overrides: Partial<OHBooking> = {}): OHBooking {
  return {
    id: crypto.randomUUID(),
    slot_id: crypto.randomUUID(),
    first_name: 'Test',
    last_name: 'User',
    email: 'test@example.com',
    confirmation_sent_at: null,
    calendar_invite_sent_at: null,
    cancelled_at: null,
    cancellation_reason: null,
    created_at: new Date().toISOString(),
    reminder_24h_sent_at: null,
    reminder_1h_sent_at: null,
    manage_token: crypto.randomUUID(),
    question_responses: null,
    attendee_timezone: 'America/New_York',
    attended_at: null,
    no_show_at: null,
    no_show_email_sent_at: null,
    feedback_sent_at: null,
    feedback_rating: null,
    feedback_comment: null,
    feedback_topic_suggestion: null,
    feedback_submitted_at: null,
    recording_sent_at: null,
    assigned_host_id: null,
    phone: null,
    sms_consent: false,
    sms_reminder_24h_sent_at: null,
    sms_reminder_1h_sent_at: null,
    is_waitlisted: false,
    waitlist_position: null,
    promoted_from_waitlist_at: null,
    waitlist_notification_sent_at: null,
    guest_emails: [],
    ...overrides,
  };
}

export function createMockAdmin(overrides: Partial<OHAdmin> = {}): OHAdmin {
  return {
    id: crypto.randomUUID(),
    email: 'admin@test.com',
    name: 'Test Admin',
    google_access_token: null,
    google_refresh_token: null,
    token_expires_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    max_meetings_per_day: 8,
    max_meetings_per_week: 30,
    default_buffer_before: 0,
    default_buffer_after: 0,
    profile_image: null,
    onboarding_progress: null,
    quick_links_token: 'test-quick-links-token-123',
    invitation_sent_at: null,
    invitation_last_sent_at: null,
    ...overrides,
  };
}

export function createMockAvailabilityPattern(
  overrides: Partial<OHAvailabilityPattern> = {}
): OHAvailabilityPattern {
  return {
    id: crypto.randomUUID(),
    admin_id: crypto.randomUUID(),
    day_of_week: 1, // Monday
    start_time: '09:00:00',
    end_time: '17:00:00',
    timezone: 'America/New_York',
    is_active: true,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

export function createMockBusyBlock(overrides: Partial<OHBusyBlock> = {}): OHBusyBlock {
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() + 1);
  start.setHours(10, 0, 0, 0);

  const end = new Date(start);
  end.setHours(11, 0, 0, 0);

  return {
    id: crypto.randomUUID(),
    admin_id: crypto.randomUUID(),
    start_time: start.toISOString(),
    end_time: end.toISOString(),
    source: 'google_calendar',
    external_event_id: null,
    synced_at: new Date().toISOString(),
    ...overrides,
  };
}

// ============================================
// SUPABASE MOCK BUILDER
// ============================================

type MockData = {
  events?: OHEvent[];
  slots?: OHSlot[];
  bookings?: OHBooking[];
  admins?: OHAdmin[];
  patterns?: OHAvailabilityPattern[];
  busyBlocks?: OHBusyBlock[];
};

type QueryResult<T> = {
  data: T | null;
  error: null | { message: string; code: string };
  count?: number;
};

class MockQueryBuilder<T> {
  private data: T[];
  private filters: Array<(item: T) => boolean> = [];
  private selectFields: string | null = null;
  private orderField: string | null = null;
  private orderAscending = true;
  private limitCount: number | null = null;
  private singleResult = false;

  constructor(data: T[]) {
    this.data = [...data];
  }

  select(fields?: string) {
    this.selectFields = fields || '*';
    return this;
  }

  eq(field: string, value: unknown) {
    this.filters.push((item) => (item as Record<string, unknown>)[field] === value);
    return this;
  }

  neq(field: string, value: unknown) {
    this.filters.push((item) => (item as Record<string, unknown>)[field] !== value);
    return this;
  }

  gt(field: string, value: unknown) {
    this.filters.push((item) => {
      const itemVal = (item as Record<string, unknown>)[field];
      return (itemVal as number | string) > (value as number | string);
    });
    return this;
  }

  gte(field: string, value: unknown) {
    this.filters.push((item) => {
      const itemVal = (item as Record<string, unknown>)[field];
      return (itemVal as number | string) >= (value as number | string);
    });
    return this;
  }

  lt(field: string, value: unknown) {
    this.filters.push((item) => {
      const itemVal = (item as Record<string, unknown>)[field];
      return (itemVal as number | string) < (value as number | string);
    });
    return this;
  }

  lte(field: string, value: unknown) {
    this.filters.push((item) => {
      const itemVal = (item as Record<string, unknown>)[field];
      return (itemVal as number | string) <= (value as number | string);
    });
    return this;
  }

  is(field: string, value: unknown) {
    this.filters.push((item) => (item as Record<string, unknown>)[field] === value);
    return this;
  }

  in(field: string, values: unknown[]) {
    this.filters.push((item) => values.includes((item as Record<string, unknown>)[field]));
    return this;
  }

  or(conditions: string) {
    // Simple or parsing for common patterns like "field.eq.value,field.eq.value2"
    return this;
  }

  order(field: string, options?: { ascending?: boolean }) {
    this.orderField = field;
    this.orderAscending = options?.ascending ?? true;
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  single(): Promise<QueryResult<T>> {
    this.singleResult = true;
    return this.execute() as Promise<QueryResult<T>>;
  }

  maybeSingle(): Promise<QueryResult<T | null>> {
    this.singleResult = true;
    return this.execute() as Promise<QueryResult<T | null>>;
  }

  async execute(): Promise<QueryResult<T[]> | QueryResult<T>> {
    let result = this.data;

    // Apply filters
    for (const filter of this.filters) {
      result = result.filter(filter);
    }

    // Apply ordering
    if (this.orderField) {
      const field = this.orderField;
      result.sort((a, b) => {
        const aVal = (a as Record<string, unknown>)[field] as number | string;
        const bVal = (b as Record<string, unknown>)[field] as number | string;
        if (aVal < bVal) return this.orderAscending ? -1 : 1;
        if (aVal > bVal) return this.orderAscending ? 1 : -1;
        return 0;
      });
    }

    // Apply limit
    if (this.limitCount !== null) {
      result = result.slice(0, this.limitCount);
    }

    // Return single or array
    if (this.singleResult) {
      if (result.length === 0) {
        return { data: null, error: { message: 'Not found', code: 'PGRST116' } };
      }
      return { data: result[0], error: null };
    }

    return { data: result, error: null, count: result.length };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  then(onfulfilled?: ((value: any) => any) | null): Promise<any> {
    return this.execute().then(onfulfilled);
  }
}

class MockInsertBuilder<T> {
  private data: T[];
  private insertData: Partial<T> | Partial<T>[];

  constructor(data: T[], insertData: Partial<T> | Partial<T>[]) {
    this.data = data;
    this.insertData = insertData;
  }

  select() {
    const items = Array.isArray(this.insertData) ? this.insertData : [this.insertData];
    const newItems = items.map((item) => ({
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      ...item,
    })) as T[];

    this.data.push(...newItems);

    return {
      single: async () => ({ data: newItems[0], error: null }),
      then: async (resolve: (val: { data: T[]; error: null }) => void) => {
        resolve({ data: newItems, error: null });
      },
    };
  }

  async then(resolve: (val: { data: null; error: null }) => void) {
    const items = Array.isArray(this.insertData) ? this.insertData : [this.insertData];
    const newItems = items.map((item) => ({
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      ...item,
    })) as T[];

    this.data.push(...newItems);
    resolve({ data: null, error: null });
  }
}

class MockUpdateBuilder<T> {
  private data: T[];
  private updates: Partial<T>;
  private filters: Array<(item: T) => boolean> = [];

  constructor(data: T[], updates: Partial<T>) {
    this.data = data;
    this.updates = updates;
  }

  eq(field: string, value: unknown) {
    this.filters.push((item) => (item as Record<string, unknown>)[field] === value);
    return this;
  }

  select() {
    return this;
  }

  single() {
    return this.execute();
  }

  async execute(): Promise<QueryResult<T>> {
    let updated: T | null = null;

    for (let i = 0; i < this.data.length; i++) {
      const item = this.data[i];
      const matches = this.filters.every((filter) => filter(item));
      if (matches) {
        this.data[i] = { ...item, ...this.updates, updated_at: new Date().toISOString() };
        updated = this.data[i];
        break;
      }
    }

    return { data: updated, error: null };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  then(onfulfilled?: ((value: any) => any) | null): Promise<any> {
    return this.execute().then(onfulfilled);
  }
}

class MockDeleteBuilder<T> {
  private data: T[];
  private filters: Array<(item: T) => boolean> = [];

  constructor(data: T[]) {
    this.data = data;
  }

  eq(field: string, value: unknown) {
    this.filters.push((item) => (item as Record<string, unknown>)[field] === value);
    return this;
  }

  async then(resolve: (val: { data: null; error: null }) => void) {
    for (let i = this.data.length - 1; i >= 0; i--) {
      const item = this.data[i];
      const matches = this.filters.every((filter) => filter(item));
      if (matches) {
        this.data.splice(i, 1);
      }
    }
    resolve({ data: null, error: null });
  }
}

class MockTableBuilder<T> {
  private data: T[];

  constructor(data: T[]) {
    this.data = data;
  }

  select(fields?: string) {
    return new MockQueryBuilder<T>(this.data).select(fields);
  }

  insert(data: Partial<T> | Partial<T>[]) {
    return new MockInsertBuilder<T>(this.data, data);
  }

  update(data: Partial<T>) {
    return new MockUpdateBuilder<T>(this.data, data);
  }

  delete() {
    return new MockDeleteBuilder<T>(this.data);
  }

  upsert(data: Partial<T> | Partial<T>[]) {
    return new MockInsertBuilder<T>(this.data, data);
  }
}

export function createMockSupabase(initialData: MockData = {}) {
  const data = {
    events: initialData.events || [],
    slots: initialData.slots || [],
    bookings: initialData.bookings || [],
    admins: initialData.admins || [],
    patterns: initialData.patterns || [],
    busyBlocks: initialData.busyBlocks || [],
  };

  const tableMap: Record<string, unknown[]> = {
    oh_events: data.events,
    oh_slots: data.slots,
    oh_bookings: data.bookings,
    oh_admins: data.admins,
    oh_availability_patterns: data.patterns,
    oh_busy_blocks: data.busyBlocks,
  };

  return {
    from: (table: string) => {
      const tableData = tableMap[table] || [];
      return new MockTableBuilder(tableData);
    },
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
    },
    // Expose data for test assertions
    _data: data,
  };
}

// ============================================
// MOCK SUPABASE INJECTION
// ============================================

export function mockSupabaseModule(mockClient: ReturnType<typeof createMockSupabase>) {
  vi.mock('@/lib/supabase', () => ({
    getServiceSupabase: () => mockClient,
    getSupabaseClient: () => mockClient,
  }));
}

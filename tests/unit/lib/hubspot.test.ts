import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ============================================
// MOCK SETUP - Must be before imports
// ============================================

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Mock Supabase before any imports
vi.mock('@/lib/supabase', () => ({
  getServiceSupabase: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === 'oh_hubspot_config') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  access_token: 'test-access-token',
                  refresh_token: 'test-refresh-token',
                  portal_id: 'test-portal-123',
                },
                error: null,
              }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      };
    }),
  })),
}));

// ============================================
// TEST HELPERS
// ============================================

function createMockResponse(data: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(data),
    text: vi.fn().mockResolvedValue(JSON.stringify(data)),
    headers: new Headers(),
    redirected: false,
    statusText: status === 200 ? 'OK' : 'Error',
    type: 'basic',
    url: '',
    clone: vi.fn(),
    body: null,
    bodyUsed: false,
    arrayBuffer: vi.fn(),
    blob: vi.fn(),
    formData: vi.fn(),
    bytes: vi.fn(),
  } as unknown as Response;
}

// ============================================
// TESTS
// ============================================

describe('HubSpot Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe('getHubSpotConfig', () => {
    it('returns config when HubSpot is configured', async () => {
      const { getHubSpotConfig } = await import('@/lib/hubspot');

      const config = await getHubSpotConfig();

      expect(config).toEqual({
        access_token: 'test-access-token',
        refresh_token: 'test-refresh-token',
        portal_id: 'test-portal-123',
      });
    });
  });

  describe('findContactByEmail', () => {
    it('finds existing contact by email', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({
        results: [{
          id: 'contact-123',
          properties: {
            email: 'test@example.com',
            firstname: 'John',
            lastname: 'Doe',
          },
        }],
      }));

      const { findContactByEmail } = await import('@/lib/hubspot');

      const contact = await findContactByEmail('test@example.com');

      expect(contact).toEqual({
        id: 'contact-123',
        properties: {
          email: 'test@example.com',
          firstname: 'John',
          lastname: 'Doe',
        },
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.hubapi.com/crm/v3/objects/contacts/search',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-access-token',
          }),
        })
      );
    });

    it('returns null when contact not found', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({ results: [] }));

      const { findContactByEmail } = await import('@/lib/hubspot');

      const contact = await findContactByEmail('notfound@example.com');

      expect(contact).toBeNull();
    });

    it('returns null on API error', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({ message: 'Error' }, 500));

      const { findContactByEmail } = await import('@/lib/hubspot');

      const contact = await findContactByEmail('test@example.com');

      expect(contact).toBeNull();
    });
  });

  describe('createContact', () => {
    it('creates new contact with all fields', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({
        id: 'new-contact-456',
        properties: {
          email: 'new@example.com',
          firstname: 'Jane',
          lastname: 'Smith',
        },
      }));

      const { createContact } = await import('@/lib/hubspot');

      const contact = await createContact('new@example.com', 'Jane', 'Smith');

      expect(contact).toEqual({
        id: 'new-contact-456',
        properties: {
          email: 'new@example.com',
          firstname: 'Jane',
          lastname: 'Smith',
        },
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.hubapi.com/crm/v3/objects/contacts',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"email":"new@example.com"'),
        })
      );
    });

    it('creates contact with only email', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({
        id: 'new-contact-789',
        properties: { email: 'minimal@example.com' },
      }));

      const { createContact } = await import('@/lib/hubspot');

      const contact = await createContact('minimal@example.com');

      expect(contact).not.toBeNull();
      expect(contact?.id).toBe('new-contact-789');
    });

    it('returns null on creation failure', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({ message: 'Duplicate' }, 409));

      const { createContact } = await import('@/lib/hubspot');

      const contact = await createContact('duplicate@example.com');

      expect(contact).toBeNull();
    });
  });

  describe('findOrCreateContact', () => {
    it('returns existing contact if found', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({
        results: [{
          id: 'existing-123',
          properties: { email: 'exists@example.com' },
        }],
      }));

      const { findOrCreateContact } = await import('@/lib/hubspot');

      const contact = await findOrCreateContact('exists@example.com', 'John', 'Doe');

      expect(contact?.id).toBe('existing-123');
      // Should only call search, not create
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('creates new contact if not found', async () => {
      // First call - search returns empty
      mockFetch.mockResolvedValueOnce(createMockResponse({ results: [] }));
      // Second call - create succeeds
      mockFetch.mockResolvedValueOnce(createMockResponse({
        id: 'new-contact-999',
        properties: { email: 'newuser@example.com' },
      }));

      const { findOrCreateContact } = await import('@/lib/hubspot');

      const contact = await findOrCreateContact('newuser@example.com', 'New', 'User');

      expect(contact?.id).toBe('new-contact-999');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('logMeetingActivity', () => {
    it('logs meeting with all details', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({ id: 'meeting-123' }));

      const { logMeetingActivity } = await import('@/lib/hubspot');

      const meetingId = await logMeetingActivity(
        'contact-123',
        {
          id: 'booking-456',
          attendee_email: 'attendee@example.com',
          attendee_name: 'Test Attendee',
          response_text: 'I want to learn about product X',
          status: 'booked',
        },
        {
          name: 'Office Hours',
          description: 'Weekly Q&A session',
        },
        {
          start_time: '2025-01-20T10:00:00Z',
          end_time: '2025-01-20T10:30:00Z',
          google_meet_link: 'https://meet.google.com/abc-123',
        }
      );

      expect(meetingId).toBe('meeting-123');

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.properties.hs_meeting_title).toContain('Office Hours');
      expect(callBody.properties.hs_meeting_outcome).toBe('SCHEDULED');
      expect(callBody.associations[0].to.id).toBe('contact-123');
    });

    it('sets hs_activity_type when hubspot_meeting_type is provided', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({ id: 'meeting-456' }));

      const { logMeetingActivity } = await import('@/lib/hubspot');

      await logMeetingActivity(
        'contact-123',
        {
          id: 'booking-789',
          attendee_email: 'demo@example.com',
          attendee_name: 'Demo User',
          status: 'booked',
        },
        {
          name: 'Product Demo',
          hubspot_meeting_type: 'first_demo', // This is the key test
        },
        {
          start_time: '2025-01-20T14:00:00Z',
          end_time: '2025-01-20T14:30:00Z',
        }
      );

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.properties.hs_activity_type).toBe('first_demo');
    });

    it('does not set hs_activity_type when meeting type is null', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({ id: 'meeting-789' }));

      const { logMeetingActivity } = await import('@/lib/hubspot');

      await logMeetingActivity(
        'contact-123',
        {
          id: 'booking-101',
          attendee_email: 'user@example.com',
          attendee_name: 'User',
          status: 'booked',
        },
        {
          name: 'Generic Meeting',
          hubspot_meeting_type: null,
        },
        {
          start_time: '2025-01-20T15:00:00Z',
          end_time: '2025-01-20T15:30:00Z',
        }
      );

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.properties.hs_activity_type).toBeUndefined();
    });

    it('sets outcome to COMPLETED for attended bookings', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({ id: 'meeting-completed' }));

      const { logMeetingActivity } = await import('@/lib/hubspot');

      await logMeetingActivity(
        'contact-123',
        {
          id: 'booking-attended',
          attendee_email: 'attended@example.com',
          attendee_name: 'Attended User',
          status: 'attended',
        },
        { name: 'Completed Session' },
        {
          start_time: '2025-01-19T10:00:00Z',
          end_time: '2025-01-19T10:30:00Z',
        }
      );

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.properties.hs_meeting_outcome).toBe('COMPLETED');
    });

    it('returns null on failure', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({ message: 'Error' }, 500));

      const { logMeetingActivity } = await import('@/lib/hubspot');

      const meetingId = await logMeetingActivity(
        'contact-123',
        {
          id: 'booking-fail',
          attendee_email: 'fail@example.com',
          attendee_name: 'Fail User',
          status: 'booked',
        },
        { name: 'Failed Meeting' },
        {
          start_time: '2025-01-20T16:00:00Z',
          end_time: '2025-01-20T16:30:00Z',
        }
      );

      expect(meetingId).toBeNull();
    });
  });

  describe('getHubSpotMeetingTypes', () => {
    it('returns meeting types from HubSpot API', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({
        options: [
          { value: 'first_demo', label: 'First Demo', displayOrder: 1, hidden: false },
          { value: 'discovery_call', label: 'Discovery Call', displayOrder: 2, hidden: false },
          { value: 'follow_up', label: 'Follow Up', displayOrder: 3, hidden: false },
        ],
      }));

      const { getHubSpotMeetingTypes } = await import('@/lib/hubspot');

      const types = await getHubSpotMeetingTypes();

      expect(types).toHaveLength(3);
      expect(types[0]).toEqual({
        value: 'first_demo',
        label: 'First Demo',
        displayOrder: 1,
        hidden: false,
      });
      expect(types[1].value).toBe('discovery_call');
      expect(types[2].value).toBe('follow_up');
    });

    it('filters out hidden meeting types', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({
        options: [
          { value: 'visible', label: 'Visible Type', displayOrder: 1, hidden: false },
          { value: 'hidden', label: 'Hidden Type', displayOrder: 2, hidden: true },
        ],
      }));

      const { getHubSpotMeetingTypes } = await import('@/lib/hubspot');

      const types = await getHubSpotMeetingTypes();

      expect(types).toHaveLength(1);
      expect(types[0].value).toBe('visible');
    });

    it('sorts by displayOrder', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({
        options: [
          { value: 'third', label: 'Third', displayOrder: 3, hidden: false },
          { value: 'first', label: 'First', displayOrder: 1, hidden: false },
          { value: 'second', label: 'Second', displayOrder: 2, hidden: false },
        ],
      }));

      const { getHubSpotMeetingTypes } = await import('@/lib/hubspot');

      const types = await getHubSpotMeetingTypes();

      expect(types[0].value).toBe('first');
      expect(types[1].value).toBe('second');
      expect(types[2].value).toBe('third');
    });

    it('returns empty array on API error', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({ message: 'Error' }, 500));

      const { getHubSpotMeetingTypes } = await import('@/lib/hubspot');

      const types = await getHubSpotMeetingTypes();

      expect(types).toEqual([]);
    });

    it('returns empty array when no options in response', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({ options: null }));

      const { getHubSpotMeetingTypes } = await import('@/lib/hubspot');

      const types = await getHubSpotMeetingTypes();

      expect(types).toEqual([]);
    });
  });

  describe('createTask', () => {
    it('creates task with all fields', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({ id: 'task-123' }));

      const { createTask } = await import('@/lib/hubspot');

      const taskId = await createTask({
        subject: 'Follow up on demo',
        body: 'Schedule follow-up call',
        dueDate: new Date('2025-01-25'),
        priority: 'HIGH',
        contactId: 'contact-123',
      });

      expect(taskId).toBe('task-123');

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.properties.hs_task_subject).toBe('Follow up on demo');
      expect(callBody.properties.hs_task_priority).toBe('HIGH');
    });

    it('uses default priority when not specified', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({ id: 'task-456' }));

      const { createTask } = await import('@/lib/hubspot');

      await createTask({
        subject: 'Default priority task',
        contactId: 'contact-123',
      });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.properties.hs_task_priority).toBe('MEDIUM');
    });
  });

  describe('isHubSpotConnected', () => {
    it('returns true when HubSpot is connected and API works', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({ results: [] }));

      const { isHubSpotConnected } = await import('@/lib/hubspot');

      const connected = await isHubSpotConnected();

      expect(connected).toBe(true);
    });

    it('returns false when API call fails', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({ message: 'Unauthorized' }, 401));

      const { isHubSpotConnected } = await import('@/lib/hubspot');

      const connected = await isHubSpotConnected();

      expect(connected).toBe(false);
    });
  });

  describe('updateMeetingOutcome', () => {
    it('updates meeting outcome for matched meeting', async () => {
      // First call - get associated meetings
      mockFetch.mockResolvedValueOnce(createMockResponse({
        results: [{ toObjectId: 'meeting-123' }],
      }));
      // Second call - get meeting details
      mockFetch.mockResolvedValueOnce(createMockResponse({
        properties: {
          hs_meeting_title: 'Connect: Office Hours',
          hs_meeting_outcome: 'SCHEDULED',
        },
      }));
      // Third call - update meeting
      mockFetch.mockResolvedValueOnce(createMockResponse({ id: 'meeting-123' }));

      const { updateMeetingOutcome } = await import('@/lib/hubspot');

      const result = await updateMeetingOutcome(
        'contact-123',
        'Office Hours',
        'COMPLETED',
        'Great session!'
      );

      expect(result).toBe(true);
    });

    it('returns false when no meetings found', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({ results: [] }));

      const { updateMeetingOutcome } = await import('@/lib/hubspot');

      const result = await updateMeetingOutcome(
        'contact-123',
        'Non-existent Meeting',
        'COMPLETED'
      );

      expect(result).toBe(false);
    });
  });
});

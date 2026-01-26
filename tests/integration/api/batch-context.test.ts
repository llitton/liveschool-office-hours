import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// We need to reset modules to clear the cache between tests
let POST: typeof import('@/app/api/attendees/batch-context/route').POST;

// Mock auth
vi.mock('@/lib/auth', () => ({
  getSession: vi.fn().mockResolvedValue({ user: { id: 'admin-1' } }),
}));

// Mock HubSpot functions
vi.mock('@/lib/hubspot', () => ({
  isHubSpotConnected: vi.fn(),
  getHubSpotConfig: vi.fn(),
  getContactWithCompany: vi.fn(),
}));

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  getServiceSupabase: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        in: vi.fn(() => ({
          is: vi.fn(() => ({
            order: vi.fn(() => ({
              data: [],
              error: null,
            })),
          })),
        })),
      })),
    })),
  })),
}));

describe('Batch Attendee Context API', () => {
  let testCounter = 0;

  beforeEach(async () => {
    vi.clearAllMocks();
    testCounter++;
    // Reset module to clear cache
    vi.resetModules();
    const module = await import('@/app/api/attendees/batch-context/route');
    POST = module.POST;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const getUniqueEmail = (prefix: string) => `${prefix}-${testCounter}-${Date.now()}@test.com`;

  describe('POST /api/attendees/batch-context', () => {
    it('returns error when not authenticated', async () => {
      const { getSession } = await import('@/lib/auth');
      vi.mocked(getSession).mockResolvedValueOnce(null);

      const request = new NextRequest('http://localhost/api/attendees/batch-context', {
        method: 'POST',
        body: JSON.stringify({ emails: ['test@example.com'] }),
      });

      const response = await POST(request);
      expect(response.status).toBe(401);
    });

    it('returns error when emails array is empty', async () => {
      const request = new NextRequest('http://localhost/api/attendees/batch-context', {
        method: 'POST',
        body: JSON.stringify({ emails: [] }),
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('emails array required');
    });

    it('returns error when emails is not an array', async () => {
      const request = new NextRequest('http://localhost/api/attendees/batch-context', {
        method: 'POST',
        body: JSON.stringify({ emails: 'test@example.com' }),
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
    });

    it('returns connected: false when HubSpot is not connected', async () => {
      const { getHubSpotConfig, isHubSpotConnected } = await import('@/lib/hubspot');
      vi.mocked(getHubSpotConfig).mockResolvedValue(null);
      vi.mocked(isHubSpotConnected).mockResolvedValue(false);

      const request = new NextRequest('http://localhost/api/attendees/batch-context', {
        method: 'POST',
        body: JSON.stringify({ emails: [getUniqueEmail('notconnected')] }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.connected).toBe(false);
      expect(data.contacts).toEqual({});
    });

    it('returns full context data from HubSpot', async () => {
      const { getHubSpotConfig, isHubSpotConnected, getContactWithCompany } = await import('@/lib/hubspot');
      vi.mocked(getHubSpotConfig).mockResolvedValue({
        access_token: 'test-token',
        refresh_token: 'test-refresh',
        portal_id: 'test-portal',
      });
      vi.mocked(isHubSpotConnected).mockResolvedValue(true);

      const email = getUniqueEmail('alice');
      vi.mocked(getContactWithCompany).mockResolvedValue({
        id: '123',
        email: email,
        firstName: 'Alice',
        lastName: 'Test',
        role: 'administrator',
        company: { name: 'Test Corp', id: '456' },
        deal: null,
        meetingsCount: 5,
      });

      const request = new NextRequest('http://localhost/api/attendees/batch-context', {
        method: 'POST',
        body: JSON.stringify({ emails: [email] }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.connected).toBe(true);
      expect(data.portalId).toBe('test-portal');
      expect(data.contacts[email.toLowerCase()]).toBeDefined();
      expect(data.contacts[email.toLowerCase()].hubspot.role).toBe('administrator');
      expect(data.contacts[email.toLowerCase()].hubspot.company.name).toBe('Test Corp');
    });

    it('fetches multiple contacts in parallel', async () => {
      const { getHubSpotConfig, isHubSpotConnected, getContactWithCompany } = await import('@/lib/hubspot');
      vi.mocked(getHubSpotConfig).mockResolvedValue({
        access_token: 'test-token',
        refresh_token: 'test-refresh',
        portal_id: 'test-portal',
      });
      vi.mocked(isHubSpotConnected).mockResolvedValue(true);

      const email1 = getUniqueEmail('bob');
      const email2 = getUniqueEmail('carol');

      vi.mocked(getContactWithCompany)
        .mockResolvedValueOnce({
          id: '123',
          email: email1,
          firstName: 'Bob',
          lastName: 'Test',
          role: 'teacher',
          company: null,
          deal: null,
          meetingsCount: 2,
        })
        .mockResolvedValueOnce({
          id: '456',
          email: email2,
          firstName: 'Carol',
          lastName: 'Test',
          role: 'site leader',
          company: { name: 'School ABC', id: '789' },
          deal: null,
          meetingsCount: 10,
        });

      const request = new NextRequest('http://localhost/api/attendees/batch-context', {
        method: 'POST',
        body: JSON.stringify({ emails: [email1, email2] }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.contacts[email1.toLowerCase()].hubspot.role).toBe('teacher');
      expect(data.contacts[email2.toLowerCase()].hubspot.role).toBe('site leader');
      expect(data.contacts[email2.toLowerCase()].hubspot.company.name).toBe('School ABC');
    });

    it('handles errors for individual contacts gracefully', async () => {
      const { getHubSpotConfig, isHubSpotConnected, getContactWithCompany } = await import('@/lib/hubspot');
      vi.mocked(getHubSpotConfig).mockResolvedValue({
        access_token: 'test-token',
        refresh_token: 'test-refresh',
        portal_id: 'test-portal',
      });
      vi.mocked(isHubSpotConnected).mockResolvedValue(true);

      const email1 = getUniqueEmail('david');
      const email2 = getUniqueEmail('erroruser');

      vi.mocked(getContactWithCompany)
        .mockResolvedValueOnce({
          id: '123',
          email: email1,
          firstName: 'David',
          lastName: 'Test',
          role: 'administrator',
          company: null,
          deal: null,
          meetingsCount: 1,
        })
        .mockRejectedValueOnce(new Error('HubSpot API error'));

      const request = new NextRequest('http://localhost/api/attendees/batch-context', {
        method: 'POST',
        body: JSON.stringify({ emails: [email1, email2] }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
      const data = await response.json();

      // First contact should succeed
      expect(data.contacts[email1.toLowerCase()].hubspot.role).toBe('administrator');
      // Second contact should have null hubspot data but still be present
      expect(data.contacts[email2.toLowerCase()].hubspot).toBeNull();
    });

    it('includes session history in response', async () => {
      const { getHubSpotConfig, isHubSpotConnected, getContactWithCompany } = await import('@/lib/hubspot');
      vi.mocked(getHubSpotConfig).mockResolvedValue({
        access_token: 'test-token',
        refresh_token: 'test-refresh',
        portal_id: 'test-portal',
      });
      vi.mocked(isHubSpotConnected).mockResolvedValue(true);

      const email = getUniqueEmail('eve');
      vi.mocked(getContactWithCompany).mockResolvedValue({
        id: '123',
        email: email,
        firstName: 'Eve',
        lastName: 'Test',
        role: 'teacher',
        company: null,
        deal: null,
        meetingsCount: 3,
      });

      const request = new NextRequest('http://localhost/api/attendees/batch-context', {
        method: 'POST',
        body: JSON.stringify({ emails: [email] }),
      });

      const response = await POST(request);
      const data = await response.json();

      // Should have session history (empty since we mocked Supabase to return empty array)
      expect(data.contacts[email.toLowerCase()].sessionHistory).toBeDefined();
      expect(data.contacts[email.toLowerCase()].sessionHistory.totalSessions).toBe(0);
      expect(data.contacts[email.toLowerCase()].sessionHistory.previousTopics).toEqual([]);
    });
  });
});

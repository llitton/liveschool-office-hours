import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// We need to reset modules to clear the cache between tests
let POST: typeof import('@/app/api/attendees/batch-types/route').POST;

// Mock auth
vi.mock('@/lib/auth', () => ({
  getSession: vi.fn().mockResolvedValue({ user: { id: 'admin-1' } }),
}));

// Mock HubSpot functions
vi.mock('@/lib/hubspot', () => ({
  isHubSpotConnected: vi.fn(),
  getHubSpotConfig: vi.fn(),
}));

describe('Batch Attendee Types API', () => {
  let testCounter = 0;

  beforeEach(async () => {
    vi.clearAllMocks();
    testCounter++;
    // Reset module to clear cache
    vi.resetModules();
    const module = await import('@/app/api/attendees/batch-types/route');
    POST = module.POST;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const getUniqueEmail = (prefix: string) => `${prefix}-${testCounter}-${Date.now()}@test.com`;

  describe('POST /api/attendees/batch-types', () => {
    it('returns error when not authenticated', async () => {
      const { getSession } = await import('@/lib/auth');
      vi.mocked(getSession).mockResolvedValueOnce(null);

      const request = new NextRequest('http://localhost/api/attendees/batch-types', {
        method: 'POST',
        body: JSON.stringify({ emails: ['test@example.com'] }),
      });

      const response = await POST(request);
      expect(response.status).toBe(401);
    });

    it('returns error when emails array is empty', async () => {
      const request = new NextRequest('http://localhost/api/attendees/batch-types', {
        method: 'POST',
        body: JSON.stringify({ emails: [] }),
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('emails array required');
    });

    it('returns error when emails is not an array', async () => {
      const request = new NextRequest('http://localhost/api/attendees/batch-types', {
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

      const request = new NextRequest('http://localhost/api/attendees/batch-types', {
        method: 'POST',
        body: JSON.stringify({ emails: [getUniqueEmail('notconnected')] }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.connected).toBe(false);
      expect(data.userTypes).toEqual({});
    });

    it('returns user types from HubSpot', async () => {
      const { getHubSpotConfig, isHubSpotConnected } = await import('@/lib/hubspot');
      vi.mocked(getHubSpotConfig).mockResolvedValue({
        access_token: 'test-token',
        refresh_token: 'test-refresh',
        portal_id: 'test-portal',
      });
      vi.mocked(isHubSpotConnected).mockResolvedValue(true);

      const email1 = getUniqueEmail('alice');
      const email2 = getUniqueEmail('bob');

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            { properties: { email: email1, user_type: 'teacher' } },
            { properties: { email: email2, user_type: 'administrator' } },
          ],
        }),
      });

      const request = new NextRequest('http://localhost/api/attendees/batch-types', {
        method: 'POST',
        body: JSON.stringify({ emails: [email1, email2] }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.connected).toBe(true);
      expect(data.userTypes[email1]).toBe('teacher');
      expect(data.userTypes[email2]).toBe('administrator');
    });

    it('falls back to user_type__liveschool_ property', async () => {
      const { getHubSpotConfig, isHubSpotConnected } = await import('@/lib/hubspot');
      vi.mocked(getHubSpotConfig).mockResolvedValue({
        access_token: 'test-token',
        refresh_token: 'test-refresh',
        portal_id: 'test-portal',
      });
      vi.mocked(isHubSpotConnected).mockResolvedValue(true);

      const email = getUniqueEmail('liveschool');

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            { properties: { email, user_type__liveschool_: 'site leader' } },
          ],
        }),
      });

      const request = new NextRequest('http://localhost/api/attendees/batch-types', {
        method: 'POST',
        body: JSON.stringify({ emails: [email] }),
      });

      const response = await POST(request);
      const data = await response.json();
      expect(data.userTypes[email]).toBe('site leader');
    });

    it('falls back to jobtitle when user_type is not set', async () => {
      const { getHubSpotConfig, isHubSpotConnected } = await import('@/lib/hubspot');
      vi.mocked(getHubSpotConfig).mockResolvedValue({
        access_token: 'test-token',
        refresh_token: 'test-refresh',
        portal_id: 'test-portal',
      });
      vi.mocked(isHubSpotConnected).mockResolvedValue(true);

      const email = getUniqueEmail('jobtitle');

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            { properties: { email, jobtitle: 'Principal' } },
          ],
        }),
      });

      const request = new NextRequest('http://localhost/api/attendees/batch-types', {
        method: 'POST',
        body: JSON.stringify({ emails: [email] }),
      });

      const response = await POST(request);
      const data = await response.json();
      expect(data.userTypes[email]).toBe('Principal');
    });

    it('returns null for emails not found in HubSpot', async () => {
      const { getHubSpotConfig, isHubSpotConnected } = await import('@/lib/hubspot');
      vi.mocked(getHubSpotConfig).mockResolvedValue({
        access_token: 'test-token',
        refresh_token: 'test-refresh',
        portal_id: 'test-portal',
      });
      vi.mocked(isHubSpotConnected).mockResolvedValue(true);

      const email = getUniqueEmail('notfound');

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: [] }),
      });

      const request = new NextRequest('http://localhost/api/attendees/batch-types', {
        method: 'POST',
        body: JSON.stringify({ emails: [email] }),
      });

      const response = await POST(request);
      const data = await response.json();
      expect(data.userTypes[email]).toBeNull();
    });
  });
});

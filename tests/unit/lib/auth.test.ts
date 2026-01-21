import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Auth Module Tests
 *
 * Tests session management, token refresh, and event access control.
 * Cookies, Supabase, and Google OAuth are mocked.
 */

// ============================================
// MOCK SETUP
// ============================================

let mockSessionId: string | null = null;
let mockAdmin: Record<string, unknown> | null = null;
let mockEvent: Record<string, unknown> | null = null;
let mockEventHost: Record<string, unknown> | null = null;
let mockTokenRefreshResult: Record<string, unknown> | null = null;

// Mock cookies
vi.mock('next/headers', () => ({
  cookies: vi.fn().mockImplementation(async () => ({
    get: (name: string) => {
      if (name === 'admin_session') {
        return mockSessionId ? { value: mockSessionId } : undefined;
      }
      return undefined;
    },
  })),
}));

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  getServiceSupabase: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === 'oh_admins') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockImplementation(async () => ({
                data: mockAdmin,
                error: mockAdmin ? null : { code: 'PGRST116' },
              })),
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        };
      }

      if (table === 'oh_events') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockImplementation(async () => ({
                data: mockEvent,
                error: mockEvent ? null : { code: 'PGRST116' },
              })),
            }),
          }),
        };
      }

      if (table === 'oh_event_hosts') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockImplementation(async () => ({
                  data: mockEventHost,
                  error: mockEventHost ? null : { code: 'PGRST116' },
                })),
              }),
            }),
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

// Mock Google OAuth
vi.mock('@/lib/google', () => ({
  refreshAccessToken: vi.fn().mockImplementation(async () => {
    if (mockTokenRefreshResult) {
      return mockTokenRefreshResult;
    }
    throw new Error('Token refresh failed');
  }),
}));

// ============================================
// TEST HELPERS
// ============================================

function createTestAdmin(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'admin-123',
    email: 'admin@test.com',
    name: 'Test Admin',
    google_access_token: 'access-token',
    google_refresh_token: 'refresh-token',
    token_expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour from now
    max_meetings_per_day: 8,
    max_meetings_per_week: 30,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

// ============================================
// TESTS
// ============================================

describe('Auth Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionId = null;
    mockAdmin = null;
    mockEvent = null;
    mockEventHost = null;
    mockTokenRefreshResult = null;
  });

  describe('getSession', () => {
    it('returns null when no session cookie exists', async () => {
      mockSessionId = null;
      vi.resetModules();
      const { getSession } = await import('@/lib/auth');

      const session = await getSession();
      expect(session).toBe(null);
    });

    it('returns null when admin not found', async () => {
      mockSessionId = 'invalid-session';
      mockAdmin = null;
      vi.resetModules();
      const { getSession } = await import('@/lib/auth');

      const session = await getSession();
      expect(session).toBe(null);
    });

    it('returns admin when session is valid', async () => {
      mockSessionId = 'admin-123';
      mockAdmin = createTestAdmin();
      vi.resetModules();
      const { getSession } = await import('@/lib/auth');

      const session = await getSession();
      expect(session).toEqual(mockAdmin);
    });

    it('refreshes token when about to expire', async () => {
      mockSessionId = 'admin-123';
      mockAdmin = createTestAdmin({
        // Token expires in 2 minutes (less than 5 minute threshold)
        token_expires_at: new Date(Date.now() + 2 * 60 * 1000).toISOString(),
      });
      mockTokenRefreshResult = {
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        expiry_date: Date.now() + 60 * 60 * 1000,
      };
      vi.resetModules();
      const { getSession } = await import('@/lib/auth');
      const { refreshAccessToken } = await import('@/lib/google');

      const session = await getSession();

      expect(refreshAccessToken).toHaveBeenCalled();
      expect(session?.google_access_token).toBe('new-access-token');
    });

    it('returns null when token refresh fails', async () => {
      mockSessionId = 'admin-123';
      mockAdmin = createTestAdmin({
        token_expires_at: new Date(Date.now() + 2 * 60 * 1000).toISOString(),
      });
      mockTokenRefreshResult = null; // Will cause refresh to fail
      vi.resetModules();
      const { getSession } = await import('@/lib/auth');

      const session = await getSession();
      expect(session).toBe(null);
    });

    it('does not refresh when token is still valid', async () => {
      mockSessionId = 'admin-123';
      mockAdmin = createTestAdmin({
        // Token expires in 10 minutes (more than 5 minute threshold)
        token_expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      });
      vi.resetModules();
      const { getSession } = await import('@/lib/auth');
      const { refreshAccessToken } = await import('@/lib/google');

      await getSession();

      expect(refreshAccessToken).not.toHaveBeenCalled();
    });

    it('skips refresh when no refresh token available', async () => {
      mockSessionId = 'admin-123';
      mockAdmin = createTestAdmin({
        google_refresh_token: null,
        token_expires_at: new Date(Date.now() + 2 * 60 * 1000).toISOString(),
      });
      vi.resetModules();
      const { getSession } = await import('@/lib/auth');
      const { refreshAccessToken } = await import('@/lib/google');

      const session = await getSession();

      expect(refreshAccessToken).not.toHaveBeenCalled();
      expect(session).toEqual(mockAdmin);
    });
  });

  describe('requireAuth', () => {
    it('throws when not authenticated', async () => {
      mockSessionId = null;
      vi.resetModules();
      const { requireAuth } = await import('@/lib/auth');

      await expect(requireAuth()).rejects.toThrow('Unauthorized');
    });

    it('returns session when authenticated', async () => {
      mockSessionId = 'admin-123';
      mockAdmin = createTestAdmin();
      vi.resetModules();
      const { requireAuth } = await import('@/lib/auth');

      const session = await requireAuth();
      expect(session).toEqual(mockAdmin);
    });
  });

  describe('requireEventAccess', () => {
    it('throws when not authenticated', async () => {
      mockSessionId = null;
      vi.resetModules();
      const { requireEventAccess } = await import('@/lib/auth');

      await expect(requireEventAccess('event-123')).rejects.toThrow('Unauthorized');
    });

    it('returns owner access when admin is event owner', async () => {
      mockSessionId = 'admin-123';
      mockAdmin = createTestAdmin();
      mockEvent = { host_id: 'admin-123' };
      vi.resetModules();
      const { requireEventAccess } = await import('@/lib/auth');

      const access = await requireEventAccess('event-123');

      expect(access.role).toBe('owner');
      expect(access.canManageSlots).toBe(true);
      expect(access.canViewBookings).toBe(true);
    });

    it('returns host access from event_hosts table', async () => {
      mockSessionId = 'admin-456';
      mockAdmin = createTestAdmin({ id: 'admin-456' });
      mockEvent = { host_id: 'admin-123' }; // Different owner
      mockEventHost = {
        role: 'host',
        can_manage_slots: true,
        can_view_bookings: false,
      };
      vi.resetModules();
      const { requireEventAccess } = await import('@/lib/auth');

      const access = await requireEventAccess('event-123');

      expect(access.role).toBe('host');
      expect(access.canManageSlots).toBe(true);
      expect(access.canViewBookings).toBe(false);
    });

    it('returns backup access for backup hosts', async () => {
      mockSessionId = 'admin-789';
      mockAdmin = createTestAdmin({ id: 'admin-789' });
      mockEvent = { host_id: 'admin-123' };
      mockEventHost = {
        role: 'backup',
        can_manage_slots: false,
        can_view_bookings: true,
      };
      vi.resetModules();
      const { requireEventAccess } = await import('@/lib/auth');

      const access = await requireEventAccess('event-123');

      expect(access.role).toBe('backup');
      expect(access.canManageSlots).toBe(false);
      expect(access.canViewBookings).toBe(true);
    });

    it('allows access to legacy events without host_id', async () => {
      mockSessionId = 'admin-123';
      mockAdmin = createTestAdmin();
      mockEvent = { host_id: null };
      mockEventHost = null;
      vi.resetModules();
      const { requireEventAccess } = await import('@/lib/auth');

      const access = await requireEventAccess('event-123');

      expect(access.role).toBe('owner');
      expect(access.canManageSlots).toBe(true);
    });

    it('throws when admin has no access to event', async () => {
      mockSessionId = 'admin-456';
      mockAdmin = createTestAdmin({ id: 'admin-456' });
      mockEvent = { host_id: 'admin-123' };
      mockEventHost = null;
      vi.resetModules();
      const { requireEventAccess } = await import('@/lib/auth');

      await expect(requireEventAccess('event-123')).rejects.toThrow(
        'You do not have access to this event'
      );
    });
  });

  describe('getHostWithTokens', () => {
    it('returns null when host not found', async () => {
      mockAdmin = null;
      vi.resetModules();
      const { getHostWithTokens } = await import('@/lib/auth');

      const host = await getHostWithTokens('invalid-host');
      expect(host).toBe(null);
    });

    it('returns host with tokens', async () => {
      mockAdmin = createTestAdmin();
      vi.resetModules();
      const { getHostWithTokens } = await import('@/lib/auth');

      const host = await getHostWithTokens('admin-123');

      expect(host).toEqual(mockAdmin);
      expect(host?.google_access_token).toBeDefined();
    });

    it('refreshes tokens when about to expire', async () => {
      mockAdmin = createTestAdmin({
        token_expires_at: new Date(Date.now() + 2 * 60 * 1000).toISOString(),
      });
      mockTokenRefreshResult = {
        access_token: 'refreshed-token',
        expiry_date: Date.now() + 60 * 60 * 1000,
      };
      vi.resetModules();
      const { getHostWithTokens } = await import('@/lib/auth');
      const { refreshAccessToken } = await import('@/lib/google');

      const host = await getHostWithTokens('admin-123');

      expect(refreshAccessToken).toHaveBeenCalled();
      expect(host?.google_access_token).toBe('refreshed-token');
    });

    it('returns original admin if token refresh fails', async () => {
      mockAdmin = createTestAdmin({
        token_expires_at: new Date(Date.now() + 2 * 60 * 1000).toISOString(),
      });
      mockTokenRefreshResult = null; // Will cause refresh to fail
      vi.resetModules();
      const { getHostWithTokens } = await import('@/lib/auth');

      const host = await getHostWithTokens('admin-123');

      // Should return the original admin even if refresh fails
      expect(host).toEqual(mockAdmin);
    });

    it('preserves refresh token if new one not provided', async () => {
      mockAdmin = createTestAdmin({
        token_expires_at: new Date(Date.now() + 2 * 60 * 1000).toISOString(),
        google_refresh_token: 'original-refresh-token',
      });
      mockTokenRefreshResult = {
        access_token: 'new-access-token',
        // No refresh_token provided
        expiry_date: Date.now() + 60 * 60 * 1000,
      };
      vi.resetModules();
      const { getHostWithTokens } = await import('@/lib/auth');

      const host = await getHostWithTokens('admin-123');

      expect(host?.google_refresh_token).toBe('original-refresh-token');
    });
  });

  describe('EventAccess interface', () => {
    it('documents the event access structure', () => {
      // This test documents the expected shape of EventAccess
      interface ExpectedEventAccess {
        session: { id: string; email: string };
        role: 'owner' | 'host' | 'backup';
        canManageSlots: boolean;
        canViewBookings: boolean;
      }

      const exampleAccess: ExpectedEventAccess = {
        session: { id: 'admin-123', email: 'admin@test.com' },
        role: 'owner',
        canManageSlots: true,
        canViewBookings: true,
      };

      expect(exampleAccess.role).toBe('owner');
      expect(['owner', 'host', 'backup']).toContain(exampleAccess.role);
    });
  });
});

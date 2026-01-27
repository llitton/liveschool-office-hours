import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Auth API Integration Tests
 *
 * Tests authentication-related API endpoints including Google disconnect.
 */

// ============================================
// MOCK SETUP
// ============================================

let mockSession: { id: string; email: string } | null = null;
let mockUpdateResult: { error: Error | null } = { error: null };

vi.mock('@/lib/auth', () => ({
  getSession: vi.fn(async () => mockSession),
}));

vi.mock('@/lib/supabase', () => ({
  getServiceSupabase: vi.fn(() => ({
    from: vi.fn(() => ({
      update: vi.fn(() => ({
        eq: vi.fn().mockImplementation(async () => mockUpdateResult),
      })),
    })),
  })),
}));

// ============================================
// TESTS
// ============================================

describe('Auth API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession = null;
    mockUpdateResult = { error: null };
  });

  describe('POST /api/auth/disconnect-google', () => {
    it('returns 401 when not authenticated', async () => {
      mockSession = null;
      vi.resetModules();

      const { POST } = await import('@/app/api/auth/disconnect-google/route');
      const response = await POST();

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
    });

    it('clears Google tokens when authenticated', async () => {
      mockSession = { id: 'admin-123', email: 'user@example.com' };
      mockUpdateResult = { error: null };
      vi.resetModules();

      const { POST } = await import('@/app/api/auth/disconnect-google/route');
      const response = await POST();

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.message).toContain('disconnected');
    });

    it('returns 500 when database update fails', async () => {
      mockSession = { id: 'admin-123', email: 'user@example.com' };
      mockUpdateResult = { error: new Error('Database error') };
      vi.resetModules();

      const { POST } = await import('@/app/api/auth/disconnect-google/route');
      const response = await POST();

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toContain('Failed');
    });
  });
});

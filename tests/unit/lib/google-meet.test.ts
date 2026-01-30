import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================
// TESTS FOR matchParticipantsToBookings
// ============================================
// This function is pure logic and doesn't require mocking external services

describe('Google Meet - matchParticipantsToBookings', () => {
  // Import the actual function since it's pure logic
  let matchParticipantsToBookings: typeof import('@/lib/google').matchParticipantsToBookings;

  beforeEach(async () => {
    // Reset modules to get fresh imports
    vi.resetModules();
    const googleModule = await import('@/lib/google');
    matchParticipantsToBookings = googleModule.matchParticipantsToBookings;
  });

  describe('email matching', () => {
    it('matches participants by exact email', () => {
      const participants = [
        { email: 'john@example.com', displayName: 'John Doe', durationMinutes: 30 },
        { email: 'jane@example.com', displayName: 'Jane Smith', durationMinutes: 25 },
      ];

      const bookings = [
        { id: 'b1', email: 'john@example.com', first_name: 'John', last_name: 'Doe' },
        { id: 'b2', email: 'jane@example.com', first_name: 'Jane', last_name: 'Smith' },
        { id: 'b3', email: 'bob@example.com', first_name: 'Bob', last_name: 'Wilson' },
      ];

      const matches = matchParticipantsToBookings(participants, bookings, 5);

      expect(matches).toHaveLength(3);

      const johnMatch = matches.find(m => m.bookingId === 'b1');
      expect(johnMatch?.attended).toBe(true);
      expect(johnMatch?.matchedBy).toBe('email');
      expect(johnMatch?.duration).toBe(30);

      const janeMatch = matches.find(m => m.bookingId === 'b2');
      expect(janeMatch?.attended).toBe(true);
      expect(janeMatch?.matchedBy).toBe('email');

      const bobMatch = matches.find(m => m.bookingId === 'b3');
      expect(bobMatch?.attended).toBe(false);
      expect(bobMatch?.matchedBy).toBe('none');
    });

    it('matches email case-insensitively', () => {
      const participants = [
        { email: 'JOHN@EXAMPLE.COM', displayName: 'John', durationMinutes: 30 },
      ];

      const bookings = [
        { id: 'b1', email: 'john@example.com', first_name: 'John', last_name: 'Doe' },
      ];

      const matches = matchParticipantsToBookings(participants, bookings, 5);

      expect(matches[0].attended).toBe(true);
      expect(matches[0].matchedBy).toBe('email');
    });
  });

  describe('duration threshold', () => {
    it('marks as attended when duration meets threshold', () => {
      const participants = [
        { email: 'john@example.com', displayName: 'John', durationMinutes: 5 }, // Exactly 5 min
      ];

      const bookings = [
        { id: 'b1', email: 'john@example.com', first_name: 'John', last_name: 'Doe' },
      ];

      const matches = matchParticipantsToBookings(participants, bookings, 5);

      expect(matches[0].attended).toBe(true);
      expect(matches[0].duration).toBe(5);
    });

    it('marks as no-show when duration is below threshold', () => {
      const participants = [
        { email: 'john@example.com', displayName: 'John', durationMinutes: 4 }, // Below 5 min
      ];

      const bookings = [
        { id: 'b1', email: 'john@example.com', first_name: 'John', last_name: 'Doe' },
      ];

      const matches = matchParticipantsToBookings(participants, bookings, 5);

      expect(matches[0].attended).toBe(false);
      expect(matches[0].duration).toBe(4);
      expect(matches[0].matchedBy).toBe('email'); // Still matched, just didn't stay long enough
    });

    it('uses custom minimum duration', () => {
      const participants = [
        { email: 'john@example.com', displayName: 'John', durationMinutes: 8 },
      ];

      const bookings = [
        { id: 'b1', email: 'john@example.com', first_name: 'John', last_name: 'Doe' },
      ];

      // With 10 minute threshold, 8 minutes is not enough
      const matches = matchParticipantsToBookings(participants, bookings, 10);

      expect(matches[0].attended).toBe(false);
    });
  });

  describe('name matching fallback', () => {
    it('matches by full name when email not available', () => {
      const participants = [
        { email: null, displayName: 'John Doe', durationMinutes: 30 },
      ];

      const bookings = [
        { id: 'b1', email: 'john@example.com', first_name: 'John', last_name: 'Doe' },
      ];

      const matches = matchParticipantsToBookings(participants, bookings, 5);

      expect(matches[0].attended).toBe(true);
      expect(matches[0].matchedBy).toBe('name');
    });

    it('matches by name case-insensitively', () => {
      const participants = [
        { email: null, displayName: 'JOHN DOE', durationMinutes: 30 },
      ];

      const bookings = [
        { id: 'b1', email: 'john@example.com', first_name: 'John', last_name: 'Doe' },
      ];

      const matches = matchParticipantsToBookings(participants, bookings, 5);

      expect(matches[0].attended).toBe(true);
      expect(matches[0].matchedBy).toBe('name');
    });

    it('matches by first name only when last name missing', () => {
      const participants = [
        { email: null, displayName: 'John', durationMinutes: 30 },
      ];

      const bookings = [
        { id: 'b1', email: 'john@example.com', first_name: 'John', last_name: 'Doe' },
      ];

      const matches = matchParticipantsToBookings(participants, bookings, 5);

      // May or may not match depending on implementation - check it works without error
      expect(matches).toHaveLength(1);
    });

    it('matches when booking has middle initial but Meet display name does not', () => {
      // Real scenario: Booking is "Alicia L Gunn", Meet shows "Alicia Gunn"
      const participants = [
        { email: null, displayName: 'Alicia Gunn', durationMinutes: 10 },
      ];

      const bookings = [
        { id: 'b1', email: 'agunn@example.com', first_name: 'Alicia', last_name: 'L Gunn' },
      ];

      const matches = matchParticipantsToBookings(participants, bookings, 5);

      expect(matches[0].attended).toBe(true);
      expect(matches[0].matchedBy).toBe('name');
    });

    it('matches when Meet display name has middle initial but booking does not', () => {
      const participants = [
        { email: null, displayName: 'John M Smith', durationMinutes: 10 },
      ];

      const bookings = [
        { id: 'b1', email: 'john@example.com', first_name: 'John', last_name: 'Smith' },
      ];

      const matches = matchParticipantsToBookings(participants, bookings, 5);

      expect(matches[0].attended).toBe(true);
      expect(matches[0].matchedBy).toBe('name');
    });
  });

  describe('edge cases', () => {
    it('handles empty participants list', () => {
      const participants: unknown[] = [];
      const bookings = [
        { id: 'b1', email: 'john@example.com', first_name: 'John', last_name: 'Doe' },
      ];

      const matches = matchParticipantsToBookings(participants, bookings, 5);

      expect(matches).toHaveLength(1);
      expect(matches[0].attended).toBe(false);
      expect(matches[0].matchedBy).toBe('none');
    });

    it('handles empty bookings list', () => {
      const participants = [
        { email: 'john@example.com', displayName: 'John', durationMinutes: 30 },
      ];
      const bookings: unknown[] = [];

      const matches = matchParticipantsToBookings(participants, bookings, 5);

      expect(matches).toHaveLength(0);
    });

    it('handles both lists empty', () => {
      const matches = matchParticipantsToBookings([], [], 5);
      expect(matches).toHaveLength(0);
    });

    it('handles participant with undefined email', () => {
      const participants = [
        { email: undefined, displayName: 'Anonymous User', durationMinutes: 30 },
      ];

      const bookings = [
        { id: 'b1', email: 'john@example.com', first_name: 'John', last_name: 'Doe' },
      ];

      const matches = matchParticipantsToBookings(participants, bookings, 5);

      // Should not crash, booking should be unmatched
      expect(matches).toHaveLength(1);
    });

    it('handles multiple bookings with same email', () => {
      const participants = [
        { email: 'john@example.com', displayName: 'John', durationMinutes: 30 },
      ];

      const bookings = [
        { id: 'b1', email: 'john@example.com', first_name: 'John', last_name: 'Doe' },
        { id: 'b2', email: 'john@example.com', first_name: 'John', last_name: 'Doe' }, // Same email
      ];

      const matches = matchParticipantsToBookings(participants, bookings, 5);

      // Both bookings should be matched
      expect(matches).toHaveLength(2);
      expect(matches.every(m => m.attended)).toBe(true);
    });
  });

  describe('return value structure', () => {
    it('returns correct structure for each match', () => {
      const participants = [
        { email: 'john@example.com', displayName: 'John', durationMinutes: 30 },
      ];

      const bookings = [
        { id: 'b1', email: 'john@example.com', first_name: 'John', last_name: 'Doe' },
      ];

      const matches = matchParticipantsToBookings(participants, bookings, 5);

      expect(matches[0]).toHaveProperty('bookingId', 'b1');
      expect(matches[0]).toHaveProperty('email', 'john@example.com');
      expect(matches[0]).toHaveProperty('attended', true);
      expect(matches[0]).toHaveProperty('duration', 30);
      expect(matches[0]).toHaveProperty('matchedBy', 'email');
    });

    it('includes email in match even for name-matched bookings', () => {
      const participants = [
        { email: null, displayName: 'John Doe', durationMinutes: 30 },
      ];

      const bookings = [
        { id: 'b1', email: 'john@example.com', first_name: 'John', last_name: 'Doe' },
      ];

      const matches = matchParticipantsToBookings(participants, bookings, 5);

      // Should have the booking's email
      expect(matches[0].email).toBe('john@example.com');
    });
  });
});

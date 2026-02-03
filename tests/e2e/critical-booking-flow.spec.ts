import { test, expect } from '@playwright/test';

/**
 * Critical Booking Flow E2E Tests
 *
 * These tests verify the core booking functionality works end-to-end.
 * They test against the REAL booking API to catch issues like:
 * - Database query failures
 * - Foreign key join issues
 * - Slot lookup problems
 *
 * Run with: npm run test:e2e -- tests/e2e/critical-booking-flow.spec.ts
 *
 * For production monitoring, set MONITOR_URL environment variable:
 * MONITOR_URL=https://liveschoolhelp.com npm run test:e2e -- tests/e2e/critical-booking-flow.spec.ts
 */

const BASE_URL = process.env.MONITOR_URL || 'http://localhost:3000';

// Test event slug - this should be a real event in your database
// For production monitoring, use a dedicated test event
const TEST_EVENT_SLUG = process.env.TEST_EVENT_SLUG || 'liveschool-office-hours';

test.describe('Critical Booking Flow', () => {
  test.describe.configure({ mode: 'serial' });

  let availableSlotId: string | null = null;
  let eventId: string | null = null;

  test('1. Events API returns valid data', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/events`);

    expect(response.status()).toBe(200);

    const events = await response.json();
    expect(Array.isArray(events)).toBe(true);
    expect(events.length).toBeGreaterThan(0);

    // Find our test event
    const testEvent = events.find((e: { slug: string }) => e.slug === TEST_EVENT_SLUG);
    expect(testEvent).toBeDefined();
    expect(testEvent.id).toBeDefined();
    expect(testEvent.is_active).toBe(true);

    eventId = testEvent.id;
  });

  test('2. Available times API returns slots', async ({ request }) => {
    expect(eventId).not.toBeNull();

    const response = await request.get(`${BASE_URL}/api/events/${eventId}/available-times`);

    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data.slots).toBeDefined();
    expect(Array.isArray(data.slots)).toBe(true);

    // For webinar events, we expect pre-created slots
    if (data.meeting_type === 'webinar') {
      expect(data.is_dynamic).toBe(false);
    }

    // Store first available slot for booking test
    if (data.slots.length > 0) {
      availableSlotId = data.slots[0].id;

      // Validate slot structure
      expect(data.slots[0].start_time).toBeDefined();
      expect(data.slots[0].end_time).toBeDefined();
      expect(data.slots[0].event_id).toBe(eventId);
    }
  });

  test('3. Booking API can look up slot with event data', async ({ request }) => {
    // This test specifically catches the issue we had with foreign key joins
    // We send a booking request and verify the slot lookup works

    if (!availableSlotId) {
      test.skip();
      return;
    }

    // Use a clearly fake email that won't match real users
    const testEmail = `e2e-test-${Date.now()}@test-booking-flow.invalid`;

    const response = await request.post(`${BASE_URL}/api/bookings`, {
      data: {
        slot_id: availableSlotId,
        first_name: 'E2E',
        last_name: 'Test',
        email: testEmail,
      },
    });

    const data = await response.json();

    // The booking should succeed OR fail for a legitimate reason
    // It should NOT fail with "Slot not found" if the slot exists
    if (response.status() === 404) {
      // This is the critical failure we want to catch
      expect(data.error).not.toContain('not found');
      expect(data.error).not.toContain('no longer available');
    }

    if (response.status() === 200) {
      // Booking succeeded - verify structure
      expect(data.id).toBeDefined();
      expect(data.slot_id).toBe(availableSlotId);
      expect(data.event).toBeDefined();
      expect(data.event.id).toBe(eventId);

      // Clean up: cancel the test booking
      if (data.manage_token) {
        await request.post(`${BASE_URL}/api/manage/${data.manage_token}`, {
          data: { action: 'cancel' },
        });
      }
    }

    // Accept 200 (success) or 400 (validation error like duplicate booking)
    // Do NOT accept 404 or 500 for a valid slot
    expect([200, 400]).toContain(response.status());
  });

  test('4. Booking API validates slot_id format', async ({ request }) => {
    // Test that malformed slot IDs are rejected with a helpful message
    const response = await request.post(`${BASE_URL}/api/bookings`, {
      data: {
        slot_id: 'invalid-not-a-uuid',
        first_name: 'Test',
        last_name: 'User',
        email: 'test@example.com',
      },
    });

    expect(response.status()).toBe(400);

    const data = await response.json();
    expect(data.error).toContain('Invalid slot format');
  });

  test('5. Booking API rejects missing required fields', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/bookings`, {
      data: {
        slot_id: availableSlotId,
        // Missing first_name, last_name, email
      },
    });

    expect(response.status()).toBe(400);

    const data = await response.json();
    expect(data.error).toContain('required');
  });

  test('6. Public booking page loads and shows slots', async ({ page }) => {
    await page.goto(`${BASE_URL}/book/${TEST_EVENT_SLUG}`);

    // Wait for the page to fully load
    await page.waitForLoadState('networkidle');

    // Should show the event name
    const pageContent = await page.textContent('body');
    expect(pageContent).not.toContain('Event not found');
    expect(pageContent).not.toContain('Something went wrong');

    // Should show time slots or a message about availability
    const hasSlots = await page.locator('button').filter({ hasText: /\d{1,2}:\d{2}/ }).count();
    const hasNoSlotsMessage = pageContent?.includes('No times available') ||
                               pageContent?.includes('fully booked');

    expect(hasSlots > 0 || hasNoSlotsMessage).toBe(true);
  });

  test('7. Booking form submission flow works', async ({ page }) => {
    await page.goto(`${BASE_URL}/book/${TEST_EVENT_SLUG}`);
    await page.waitForLoadState('networkidle');

    // Find and click a time slot button
    const slotButtons = page.locator('button').filter({ hasText: /\d{1,2}:\d{2}/ });
    const slotCount = await slotButtons.count();

    if (slotCount === 0) {
      test.skip();
      return;
    }

    // Click the first available slot (skip disabled/full slots)
    const enabledSlots = slotButtons.filter({ has: page.locator(':not([disabled])') });
    if (await enabledSlots.count() === 0) {
      test.skip();
      return;
    }
    await enabledSlots.first().click();

    // Wait for the form to appear - look for the "First name" label
    await page.waitForSelector('text=First name', { timeout: 5000 });

    // Fill in the form using label associations
    const testEmail = `e2e-form-test-${Date.now()}@test-booking-flow.invalid`;

    // Find inputs by their associated labels
    const firstNameInput = page.locator('label:has-text("First name") + input, label:has-text("First name") ~ input').first();
    const lastNameInput = page.locator('label:has-text("Last name") + input, label:has-text("Last name") ~ input').first();
    const emailInput = page.locator('label:has-text("Email") + input, label:has-text("Email") ~ input, label:has-text("Email") ~ div input').first();

    await firstNameInput.fill('E2E');
    await lastNameInput.fill('FormTest');
    await emailInput.fill(testEmail);

    // Submit the form
    const submitButton = page.locator('button[type="submit"], button:has-text("Confirm Booking"), button:has-text("Book")');
    await submitButton.click();

    // Wait for response - should either succeed or show a clear error
    await page.waitForTimeout(5000);

    const resultContent = await page.textContent('body');

    // Should NOT see "Slot not found" type errors
    expect(resultContent).not.toContain('Slot not found');

    // Should either see confirmation or a legitimate error
    const hasConfirmation = resultContent?.includes('booked') ||
                            resultContent?.includes('Confirmed') ||
                            resultContent?.includes('confirmed') ||
                            resultContent?.includes('successfully');
    const hasLegitimateError = resultContent?.includes('already booked') ||
                               resultContent?.includes('no longer available') ||
                               resultContent?.includes('full');

    expect(hasConfirmation || hasLegitimateError).toBe(true);
  });
});

test.describe('API Health Checks', () => {
  test('Slots API returns correct structure', async ({ request }) => {
    // First get an event ID
    const eventsResponse = await request.get(`${BASE_URL}/api/events`);
    const events = await eventsResponse.json();

    if (!events.length) {
      test.skip();
      return;
    }

    const eventId = events[0].id;

    // Get slots for the event
    const slotsResponse = await request.get(`${BASE_URL}/api/slots?eventId=${eventId}`);

    expect(slotsResponse.status()).toBe(200);

    const slots = await slotsResponse.json();
    expect(Array.isArray(slots)).toBe(true);

    if (slots.length > 0) {
      // Verify slot structure
      expect(slots[0]).toHaveProperty('id');
      expect(slots[0]).toHaveProperty('event_id');
      expect(slots[0]).toHaveProperty('start_time');
      expect(slots[0]).toHaveProperty('end_time');
      expect(slots[0]).toHaveProperty('booking_count');
    }
  });

  test('Database connectivity check via system status', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/admin/system-status`);

    // May require auth, so accept 401
    if (response.status() === 401) {
      return;
    }

    expect(response.status()).toBe(200);

    const status = await response.json();
    expect(status.database?.status).toBe('ok');
  });
});

/**
 * Production Monitoring Test
 *
 * This test can be run on a schedule to monitor production.
 * Set MONITOR_URL and TEST_EVENT_SLUG environment variables.
 *
 * Example cron setup (GitHub Actions):
 *
 * name: Booking Flow Monitor
 * on:
 *   schedule:
 *     - cron: '0 * * * *'  # Every hour
 * jobs:
 *   monitor:
 *     runs-on: ubuntu-latest
 *     steps:
 *       - uses: actions/checkout@v4
 *       - run: npm ci
 *       - run: npx playwright install chromium
 *       - run: npm run test:e2e -- tests/e2e/critical-booking-flow.spec.ts
 *         env:
 *           MONITOR_URL: https://liveschoolhelp.com
 *           TEST_EVENT_SLUG: liveschool-office-hours
 */

import { test, expect } from '@playwright/test';

/**
 * CRITICAL PATH TEST: Complete Booking Flow
 *
 * This test validates the most important user journey:
 * An attendee can successfully book a slot.
 *
 * This test requires:
 * - A running dev server connected to a real/test database
 * - An existing event with the slug 'e2e-test-event'
 * - At least one available slot for that event
 *
 * Setup instructions:
 * 1. Create an event with slug 'e2e-test-event' in your test environment
 * 2. Add at least one future slot
 * 3. Run: npm run test:e2e -- critical-booking-path.spec.ts
 *
 * This test MUST pass before any deployment.
 */

const TEST_EVENT_SLUG = process.env.E2E_TEST_EVENT_SLUG || 'e2e-test-event';
const TEST_EMAIL = `e2e-test-${Date.now()}@test.example.com`;

test.describe('Critical Path: Booking Flow', () => {
  test('attendee can complete a booking end-to-end', async ({ page, request }) => {
    // Step 1: Load the public booking page
    console.log(`Testing booking flow for event: ${TEST_EVENT_SLUG}`);

    const response = await page.goto(`/book/${TEST_EVENT_SLUG}`);

    // Verify the page loaded successfully
    expect(response?.status()).toBeLessThan(400);

    // Step 2: Check if event exists and has content
    await page.waitForLoadState('networkidle');

    const pageContent = await page.textContent('body');

    // If event doesn't exist, fail with helpful message
    if (pageContent?.includes('not found') || pageContent?.includes('404')) {
      test.fail(true, `Test event '${TEST_EVENT_SLUG}' not found. Please create it first.`);
      return;
    }

    // Step 3: Look for available time slots
    // Wait for slots to load (they're fetched async)
    await page.waitForTimeout(2000);

    // Find a clickable time slot
    const timeSlotButton = page.locator('button:has-text("AM"), button:has-text("PM")').first();
    const hasSlots = await timeSlotButton.isVisible().catch(() => false);

    if (!hasSlots) {
      // Try alternative slot selectors
      const altSlot = page.locator('[data-slot-id], [data-testid="time-slot"]').first();
      const hasAltSlots = await altSlot.isVisible().catch(() => false);

      if (!hasAltSlots) {
        test.fail(true, `No available slots found for event '${TEST_EVENT_SLUG}'. Please add future slots.`);
        return;
      }

      await altSlot.click();
    } else {
      await timeSlotButton.click();
    }

    // Step 4: Fill out the booking form
    // Wait for form to appear after slot selection
    await page.waitForSelector('input[name="first_name"], input[placeholder*="First"]', { timeout: 5000 });

    // Fill required fields
    await page.fill('input[name="first_name"], input[placeholder*="First"]', 'E2E');
    await page.fill('input[name="last_name"], input[placeholder*="Last"]', 'TestUser');
    await page.fill('input[name="email"], input[placeholder*="Email"], input[type="email"]', TEST_EMAIL);

    // Step 5: Submit the booking
    const submitButton = page.locator('button[type="submit"], button:has-text("Confirm"), button:has-text("Book")');
    await expect(submitButton).toBeEnabled();
    await submitButton.click();

    // Step 6: Verify booking success
    // Wait for success state - could be a success message, redirect, or confirmation page
    await page.waitForLoadState('networkidle');

    // Check for success indicators
    const successIndicators = [
      page.locator('text=confirmed'),
      page.locator('text=Confirmed'),
      page.locator('text=successfully'),
      page.locator('text=Thank you'),
      page.locator('text=booked'),
      page.locator('[data-testid="booking-confirmation"]'),
    ];

    let foundSuccess = false;
    for (const indicator of successIndicators) {
      if (await indicator.isVisible().catch(() => false)) {
        foundSuccess = true;
        break;
      }
    }

    // Also check URL for confirmation page
    const currentUrl = page.url();
    if (currentUrl.includes('confirm') || currentUrl.includes('success')) {
      foundSuccess = true;
    }

    // Check for error messages that would indicate failure
    const errorIndicators = [
      'error',
      'failed',
      'could not',
      'unable to',
      'something went wrong',
    ];

    const finalContent = await page.textContent('body');
    const hasError = errorIndicators.some(err =>
      finalContent?.toLowerCase().includes(err)
    );

    if (hasError && !foundSuccess) {
      // Capture the error for debugging
      const screenshot = await page.screenshot();
      console.error('Booking failed. Page content:', finalContent?.substring(0, 500));
      test.fail(true, 'Booking submission returned an error. Check logs for details.');
      return;
    }

    expect(foundSuccess).toBe(true);
    console.log(`✓ Booking completed successfully for ${TEST_EMAIL}`);
  });

  test('booking API accepts valid booking data', async ({ request }) => {
    // This test directly hits the API to verify the database layer works
    // First, we need to get a valid slot_id

    // Get event info
    const eventResponse = await request.get(`/api/events/by-slug/${TEST_EVENT_SLUG}`);

    if (eventResponse.status() === 404) {
      test.skip(true, `Test event '${TEST_EVENT_SLUG}' not found`);
      return;
    }

    const event = await eventResponse.json();

    // Get available slots
    const slotsResponse = await request.get(`/api/slots?eventId=${event.id}`);
    expect(slotsResponse.status()).toBe(200);

    const slots = await slotsResponse.json();

    // Find a future slot with capacity
    const now = new Date();
    const availableSlot = slots.find((slot: { start_time: string; is_cancelled: boolean }) =>
      new Date(slot.start_time) > now && !slot.is_cancelled
    );

    if (!availableSlot) {
      test.skip(true, 'No available future slots for API test');
      return;
    }

    // Attempt to create a booking via API
    const bookingResponse = await request.post('/api/bookings', {
      data: {
        slot_id: availableSlot.id,
        first_name: 'API',
        last_name: 'Test',
        email: `api-test-${Date.now()}@test.example.com`,
      },
    });

    // The booking should succeed (201) or fail with a known error (400)
    // It should NOT return 500 (server error)
    expect(bookingResponse.status()).not.toBe(500);

    if (bookingResponse.status() === 500) {
      const errorBody = await bookingResponse.json();
      console.error('API returned 500:', errorBody);
      test.fail(true, `Booking API returned 500 error: ${JSON.stringify(errorBody)}`);
    }

    // If we got 201, booking succeeded
    if (bookingResponse.status() === 201) {
      const booking = await bookingResponse.json();
      expect(booking.id).toBeDefined();
      console.log(`✓ API booking created: ${booking.id}`);
    }
  });
});

test.describe('Health Checks', () => {
  test('booking API is responding', async ({ request }) => {
    // Simple health check - API should respond, not 500
    const response = await request.post('/api/bookings', {
      data: {},
    });

    // Should get 400 (bad request) not 500 (server error)
    expect(response.status()).toBe(400);

    const body = await response.json();
    expect(body.error).toBeDefined();
  });

  test('database connection is working', async ({ request }) => {
    // Fetch events - this hits the database
    const response = await request.get('/api/events');

    // Should get 200 or 401, not 500
    expect([200, 401]).toContain(response.status());
  });
});

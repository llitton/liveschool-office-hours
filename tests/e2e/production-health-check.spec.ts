import { test, expect } from '@playwright/test';

/**
 * Production Health Check - Multi-Event Booking Test
 *
 * This test discovers all active public events and attempts a test booking
 * on each one, then cleans up by canceling the booking.
 *
 * Purpose: Catch booking failures like the "slot not found" issue before
 * real users encounter them.
 *
 * Run locally against dev:
 *   npm run test:e2e -- tests/e2e/production-health-check.spec.ts
 *
 * Run against production:
 *   MONITOR_URL=https://liveschoolhelp.com npm run test:e2e -- tests/e2e/production-health-check.spec.ts
 *
 * For scheduled monitoring, use GitHub Actions or a cron job with MONITOR_URL set.
 */

const BASE_URL = process.env.MONITOR_URL || 'http://localhost:3000';
const TEST_EMAIL_DOMAIN = 'e2e-health-check.invalid';

interface ActiveEvent {
  id: string;
  slug: string;
  name: string;
  meeting_type: string;
  is_active: boolean;
  max_attendees: number;
}

interface AvailableSlot {
  id: string;
  start_time: string;
  end_time: string;
  event_id: string;
  booking_count: number;
}

interface BookingResult {
  eventSlug: string;
  eventName: string;
  meetingType: string;
  status: 'success' | 'no_slots' | 'failed' | 'skipped';
  bookingId?: string;
  manageToken?: string;
  error?: string;
  cleanedUp?: boolean;
}

test.describe('Production Health Check', () => {
  test.describe.configure({ mode: 'serial', timeout: 120000 });

  const results: BookingResult[] = [];
  let activeEvents: ActiveEvent[] = [];

  test('1. Discover all active public events', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/events`);
    expect(response.status()).toBe(200);

    const events = await response.json();
    expect(Array.isArray(events)).toBe(true);

    activeEvents = events.filter((e: ActiveEvent) => e.is_active);

    console.log(`\n📋 Found ${activeEvents.length} active events:`);
    for (const event of activeEvents) {
      console.log(`   - ${event.name} (${event.meeting_type}) [${event.slug}]`);
    }

    expect(activeEvents.length).toBeGreaterThan(0);
  });

  test('2. Test booking flow for each active event', async ({ request }) => {
    expect(activeEvents.length).toBeGreaterThan(0);

    for (const event of activeEvents) {
      console.log(`\n🔍 Testing: ${event.name} (${event.meeting_type})`);

      const result: BookingResult = {
        eventSlug: event.slug,
        eventName: event.name,
        meetingType: event.meeting_type,
        status: 'failed',
      };

      try {
        // Get available slots
        const slotsResponse = await request.get(
          `${BASE_URL}/api/events/${event.id}/available-times`
        );

        if (slotsResponse.status() !== 200) {
          result.status = 'failed';
          result.error = `Failed to fetch slots: ${slotsResponse.status()}`;
          results.push(result);
          console.log(`   ❌ ${result.error}`);
          continue;
        }

        const slotsData = await slotsResponse.json();
        const slots: AvailableSlot[] = slotsData.slots || [];

        // Find a slot that has capacity
        const availableSlot = slots.find((s) => {
          const remainingCapacity = event.max_attendees - (s.booking_count || 0);
          return remainingCapacity > 0;
        });

        if (!availableSlot) {
          result.status = 'no_slots';
          result.error = 'No available slots with capacity';
          results.push(result);
          console.log(`   ⏭️ Skipped: ${result.error}`);
          continue;
        }

        // Attempt test booking
        const testEmail = `health-check-${Date.now()}-${event.slug}@${TEST_EMAIL_DOMAIN}`;

        const bookingResponse = await request.post(`${BASE_URL}/api/bookings`, {
          data: {
            slot_id: availableSlot.id,
            first_name: 'HealthCheck',
            last_name: 'Test',
            email: testEmail,
          },
        });

        const bookingData = await bookingResponse.json();

        if (bookingResponse.status() === 200 && bookingData.id) {
          result.status = 'success';
          result.bookingId = bookingData.id;
          result.manageToken = bookingData.manage_token;
          console.log(`   ✅ Booking created: ${result.bookingId}`);
        } else if (bookingResponse.status() === 400) {
          // Expected errors like "already booked" or validation
          result.status = 'skipped';
          result.error = bookingData.error || 'Validation error';
          console.log(`   ⏭️ Skipped: ${result.error}`);
        } else {
          result.status = 'failed';
          result.error = bookingData.error || `HTTP ${bookingResponse.status()}`;
          console.log(`   ❌ Failed: ${result.error}`);
        }
      } catch (err) {
        result.status = 'failed';
        result.error = err instanceof Error ? err.message : 'Unknown error';
        console.log(`   ❌ Exception: ${result.error}`);
      }

      results.push(result);
    }
  });

  test('3. Clean up test bookings', async ({ request }) => {
    const successfulBookings = results.filter(
      (r) => r.status === 'success' && r.manageToken
    );

    console.log(`\n🧹 Cleaning up ${successfulBookings.length} test bookings...`);

    for (const result of successfulBookings) {
      try {
        const cancelResponse = await request.post(
          `${BASE_URL}/api/manage/${result.manageToken}`,
          {
            data: { action: 'cancel' },
          }
        );

        if (cancelResponse.status() === 200) {
          result.cleanedUp = true;
          console.log(`   ✅ Cancelled booking for ${result.eventSlug}`);
        } else {
          result.cleanedUp = false;
          console.log(`   ⚠️ Failed to cancel booking for ${result.eventSlug}`);
        }
      } catch (err) {
        result.cleanedUp = false;
        console.log(`   ⚠️ Exception cancelling ${result.eventSlug}: ${err}`);
      }
    }
  });

  test('4. Report results', async () => {
    console.log('\n' + '='.repeat(60));
    console.log('📊 HEALTH CHECK SUMMARY');
    console.log('='.repeat(60));

    const successful = results.filter((r) => r.status === 'success');
    const noSlots = results.filter((r) => r.status === 'no_slots');
    const skipped = results.filter((r) => r.status === 'skipped');
    const failed = results.filter((r) => r.status === 'failed');

    console.log(`\n✅ Successful bookings: ${successful.length}`);
    for (const r of successful) {
      console.log(`   - ${r.eventName} (${r.meetingType}) - cleaned up: ${r.cleanedUp ? 'yes' : 'NO'}`);
    }

    if (noSlots.length > 0) {
      console.log(`\n⏭️ No available slots: ${noSlots.length}`);
      for (const r of noSlots) {
        console.log(`   - ${r.eventName} (${r.meetingType})`);
      }
    }

    if (skipped.length > 0) {
      console.log(`\n⏭️ Skipped (validation): ${skipped.length}`);
      for (const r of skipped) {
        console.log(`   - ${r.eventName}: ${r.error}`);
      }
    }

    if (failed.length > 0) {
      console.log(`\n❌ FAILED: ${failed.length}`);
      for (const r of failed) {
        console.log(`   - ${r.eventName} (${r.meetingType}): ${r.error}`);
      }
    }

    console.log('\n' + '='.repeat(60));

    // Test passes only if no failures
    // no_slots and skipped are acceptable
    expect(failed.length).toBe(0);

    // At least one event should have been testable
    expect(successful.length + noSlots.length + skipped.length).toBeGreaterThan(0);
  });
});

/**
 * Quick smoke test - just checks the booking API doesn't 500
 */
test.describe('Quick Smoke Test', () => {
  test('Booking API responds correctly to valid request', async ({ request }) => {
    // Get first active event
    const eventsResponse = await request.get(`${BASE_URL}/api/events`);
    const events = await eventsResponse.json();
    const activeEvent = events.find((e: ActiveEvent) => e.is_active);

    if (!activeEvent) {
      test.skip();
      return;
    }

    // Get a slot
    const slotsResponse = await request.get(
      `${BASE_URL}/api/events/${activeEvent.id}/available-times`
    );
    const slotsData = await slotsResponse.json();

    if (!slotsData.slots?.length) {
      test.skip();
      return;
    }

    // Try booking with clearly invalid email (won't send actual email)
    const testEmail = `smoke-test-${Date.now()}@${TEST_EMAIL_DOMAIN}`;

    const response = await request.post(`${BASE_URL}/api/bookings`, {
      data: {
        slot_id: slotsData.slots[0].id,
        first_name: 'Smoke',
        last_name: 'Test',
        email: testEmail,
      },
    });

    // Should get 200 (success) or 400 (validation) - NOT 404 or 500
    expect([200, 400]).toContain(response.status());

    const data = await response.json();

    // If successful, clean up
    if (response.status() === 200 && data.manage_token) {
      await request.post(`${BASE_URL}/api/manage/${data.manage_token}`, {
        data: { action: 'cancel' },
      });
    }

    // Should never see "Slot not found" for a valid slot
    if (response.status() === 404) {
      expect(data.error).not.toContain('not found');
    }
  });
});

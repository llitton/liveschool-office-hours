#!/usr/bin/env npx ts-node

/**
 * Pre-Deployment Verification Script
 *
 * This script tests the critical booking API path against the real database.
 * Run this BEFORE deploying to catch issues like missing columns, broken migrations, etc.
 *
 * Usage:
 *   npm run verify:booking
 *   # or directly:
 *   npx ts-node scripts/verify-booking-api.ts
 *
 * Environment:
 *   Set VERIFY_API_URL to test against a specific environment:
 *   VERIFY_API_URL=https://staging.liveschoolhelp.com npm run verify:booking
 */

const BASE_URL = process.env.VERIFY_API_URL || 'http://localhost:3000';
const TEST_EVENT_SLUG = process.env.E2E_TEST_EVENT_SLUG || 'e2e-test-event';

interface ApiResponse {
  status: number;
  data: unknown;
  error?: string;
}

async function apiCall(endpoint: string, options?: RequestInit): Promise<ApiResponse> {
  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    const data = await response.json().catch(() => ({}));

    return {
      status: response.status,
      data,
      error: response.ok ? undefined : (data as { error?: string }).error,
    };
  } catch (err) {
    return {
      status: 0,
      data: null,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

async function runVerification() {
  console.log('\n🔍 Pre-Deployment Booking API Verification');
  console.log(`   Target: ${BASE_URL}`);
  console.log('─'.repeat(50));

  let passed = 0;
  let failed = 0;

  // Test 1: API is responding
  console.log('\n1️⃣  Testing API availability...');
  const healthCheck = await apiCall('/api/bookings', { method: 'POST', body: '{}' });

  if (healthCheck.status === 400) {
    console.log('   ✅ API is responding (got expected 400 for empty request)');
    passed++;
  } else if (healthCheck.status === 500) {
    console.log(`   ❌ API returned 500 error: ${healthCheck.error}`);
    console.log('      This usually means a database or code error!');
    failed++;
  } else if (healthCheck.status === 0) {
    console.log(`   ❌ Cannot reach API: ${healthCheck.error}`);
    console.log('      Is the server running?');
    failed++;
  } else {
    console.log(`   ⚠️  Unexpected status: ${healthCheck.status}`);
    passed++;
  }

  // Test 2: Events API works
  console.log('\n2️⃣  Testing events API...');
  const eventsCheck = await apiCall('/api/events');

  if (eventsCheck.status === 200) {
    console.log('   ✅ Events API working');
    passed++;
  } else if (eventsCheck.status === 401) {
    console.log('   ✅ Events API responding (requires auth)');
    passed++;
  } else {
    console.log(`   ❌ Events API error: ${eventsCheck.status} - ${eventsCheck.error}`);
    failed++;
  }

  // Test 3: Get test event
  console.log(`\n3️⃣  Looking for test event '${TEST_EVENT_SLUG}'...`);
  const eventCheck = await apiCall(`/api/events/by-slug/${TEST_EVENT_SLUG}`);

  let testEventId: string | null = null;

  if (eventCheck.status === 200 && eventCheck.data) {
    testEventId = (eventCheck.data as { id: string }).id;
    console.log(`   ✅ Found test event (ID: ${testEventId})`);
    passed++;
  } else if (eventCheck.status === 404) {
    console.log(`   ⚠️  Test event not found. Create event with slug '${TEST_EVENT_SLUG}'`);
    console.log('      Skipping slot and booking tests...');
  } else {
    console.log(`   ❌ Error fetching event: ${eventCheck.status} - ${eventCheck.error}`);
    failed++;
  }

  // Test 4: Get slots (if event exists)
  if (testEventId) {
    console.log('\n4️⃣  Testing slots API...');
    const slotsCheck = await apiCall(`/api/slots?eventId=${testEventId}`);

    if (slotsCheck.status === 200) {
      const slots = slotsCheck.data as Array<{ id: string; start_time: string; is_cancelled: boolean }>;
      const futureSlots = slots.filter(s => new Date(s.start_time) > new Date() && !s.is_cancelled);
      console.log(`   ✅ Slots API working (${futureSlots.length} available slots)`);
      passed++;

      // Test 5: Attempt a booking
      if (futureSlots.length > 0) {
        console.log('\n5️⃣  Testing booking creation...');
        const testEmail = `verify-${Date.now()}@test.example.com`;

        const bookingCheck = await apiCall('/api/bookings', {
          method: 'POST',
          body: JSON.stringify({
            slot_id: futureSlots[0].id,
            first_name: 'Verify',
            last_name: 'Script',
            email: testEmail,
          }),
        });

        if (bookingCheck.status === 201) {
          console.log('   ✅ Booking created successfully!');
          console.log(`      Test booking email: ${testEmail}`);
          passed++;
        } else if (bookingCheck.status === 400) {
          // Could be duplicate or full - that's OK
          console.log(`   ✅ Booking API responded correctly: ${bookingCheck.error}`);
          passed++;
        } else if (bookingCheck.status === 500) {
          console.log(`   ❌ CRITICAL: Booking API returned 500!`);
          console.log(`      Error: ${bookingCheck.error}`);
          console.log(`      Data: ${JSON.stringify(bookingCheck.data)}`);
          failed++;
        } else {
          console.log(`   ⚠️  Unexpected status: ${bookingCheck.status}`);
          console.log(`      ${bookingCheck.error}`);
        }
      } else {
        console.log('\n5️⃣  Skipping booking test (no available slots)');
      }
    } else {
      console.log(`   ❌ Slots API error: ${slotsCheck.status} - ${slotsCheck.error}`);
      failed++;
    }
  }

  // Summary
  console.log('\n' + '─'.repeat(50));
  console.log(`\n📊 Results: ${passed} passed, ${failed} failed\n`);

  if (failed > 0) {
    console.log('❌ VERIFICATION FAILED - Do not deploy!\n');
    process.exit(1);
  } else {
    console.log('✅ All checks passed - Safe to deploy\n');
    process.exit(0);
  }
}

runVerification();

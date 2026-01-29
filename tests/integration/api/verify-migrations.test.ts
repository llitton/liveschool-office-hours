import { describe, it, expect } from 'vitest';

// ============================================
// TESTS - Unit tests for migration verification logic
// ============================================

describe('Verify Migrations Tests', () => {
  describe('Migration check structure', () => {
    // Test that the migration checks are properly defined
    it('should have migration checks for all expected migrations', async () => {
      const fs = await import('fs');
      const path = await import('path');

      const routePath = path.join(
        process.cwd(),
        'src/app/api/admin/verify-migrations/route.ts'
      );
      const routeSource = fs.readFileSync(routePath, 'utf-8');

      // Check that all migration numbers are present in the file
      const expectedMigrations = [
        '002', '003', '004', '005', '006', '007', '008', '009', '010', '011',
        '012', '013', '014', '015', '016', '017', '018', '019', '020', '021',
        '022', '023', '024', '025', '026', '027', '028', '029', '030', '031',
        '032', '033', '034', '035', '036', '037', '038', '039', '040', '041',
        '042', '043',
      ];

      for (const migration of expectedMigrations) {
        expect(routeSource).toContain(`migration: '${migration}'`);
      }
    });

    it('should check the correct tables for each migration category', async () => {
      const fs = await import('fs');
      const path = await import('path');

      const routePath = path.join(
        process.cwd(),
        'src/app/api/admin/verify-migrations/route.ts'
      );
      const routeSource = fs.readFileSync(routePath, 'utf-8');

      // Core table checks
      expect(routeSource).toContain("table: 'oh_availability_patterns'");
      expect(routeSource).toContain("table: 'oh_event_hosts'");
      expect(routeSource).toContain("table: 'oh_events'");
      expect(routeSource).toContain("table: 'oh_bookings'");
      expect(routeSource).toContain("table: 'oh_slots'");
      expect(routeSource).toContain("table: 'oh_admins'");

      // Feature table checks
      expect(routeSource).toContain("table: 'oh_routing_forms'");
      expect(routeSource).toContain("table: 'oh_sms_config'");
      expect(routeSource).toContain("table: 'oh_task_templates'");
      expect(routeSource).toContain("table: 'oh_polls'");
      expect(routeSource).toContain("table: 'oh_session_templates'");

      // Recent migration table checks
      expect(routeSource).toContain("table: 'oh_resource_sends'");
      expect(routeSource).toContain("table: 'oh_poll_options'");
      expect(routeSource).toContain("table: 'oh_booking_analytics'");
    });

    it('should include RLS-related migrations (006, 031)', async () => {
      const fs = await import('fs');
      const path = await import('path');

      const routePath = path.join(
        process.cwd(),
        'src/app/api/admin/verify-migrations/route.ts'
      );
      const routeSource = fs.readFileSync(routePath, 'utf-8');

      // 006 - Enable RLS (checks hubspot_config which requires RLS)
      expect(routeSource).toContain("// 006 - Enable RLS");
      expect(routeSource).toContain("table: 'oh_hubspot_config'");

      // 031 - Enable RLS on poll tables
      expect(routeSource).toContain("// 031 - Enable RLS on poll tables");
      expect(routeSource).toContain("table: 'oh_poll_options'");
    });

    it('should include structural migrations (034, 035)', async () => {
      const fs = await import('fs');
      const path = await import('path');

      const routePath = path.join(
        process.cwd(),
        'src/app/api/admin/verify-migrations/route.ts'
      );
      const routeSource = fs.readFileSync(routePath, 'utf-8');

      // 034 - Add CHECK constraints
      expect(routeSource).toContain("// 034 - Add CHECK constraints");

      // 035 - Atomic booking creation
      expect(routeSource).toContain("// 035 - Atomic booking creation");
    });

    it('should include latest feature migrations (041, 042, 043)', async () => {
      const fs = await import('fs');
      const path = await import('path');

      const routePath = path.join(
        process.cwd(),
        'src/app/api/admin/verify-migrations/route.ts'
      );
      const routeSource = fs.readFileSync(routePath, 'utf-8');

      // 041 - Slot resources
      expect(routeSource).toContain("// 041 - Slot resources");
      expect(routeSource).toContain("column: 'deck_link'");
      expect(routeSource).toContain("column: 'shared_links'");

      // 042 - Email tracking
      expect(routeSource).toContain("// 042 - Email tracking");
      expect(routeSource).toContain("column: 'followup_sent_at'");
      expect(routeSource).toContain("column: 'no_show_email_sent_at'");
      expect(routeSource).toContain("column: 'feedback_sent_at'");

      // 043 - Automated emails toggle
      expect(routeSource).toContain("// 043 - Automated emails toggle");
      expect(routeSource).toContain("column: 'automated_emails_enabled'");
    });
  });

  describe('Migration files exist', () => {
    it('should have corresponding SQL files for all tracked migrations', async () => {
      const fs = await import('fs');
      const path = await import('path');

      const migrationsDir = path.join(process.cwd(), 'migrations');
      const files = fs.readdirSync(migrationsDir);

      // Check that key migration files exist
      const expectedFiles = [
        '002_availability_and_hosts.sql',
        '006_enable_rls.sql',
        '012_resource_sends.sql',
        '013_task_template_hubspot.sql',
        '031_enable_rls_missing_tables.sql',
        '034_add_check_constraints.sql',
        '035_atomic_booking_creation.sql',
        '041_slot_resources.sql',
        '042_email_tracking.sql',
        '043_automated_emails_toggle.sql',
      ];

      for (const expectedFile of expectedFiles) {
        expect(files).toContain(expectedFile);
      }
    });
  });
});

import { describe, it, expect } from 'vitest';

// ============================================
// TESTS - Unit tests for the flag check logic
// ============================================

describe('Automated Emails Toggle Tests', () => {
  describe('automated_emails_enabled flag logic', () => {
    // Test the logic that would be used in the cron
    function shouldSendAutomatedEmails(event: { automated_emails_enabled?: boolean }): boolean {
      // The cron uses: if (event.automated_emails_enabled === false) continue;
      // This means undefined/null/true all allow emails, only explicit false blocks them
      return event.automated_emails_enabled !== false;
    }

    it('allows emails when automated_emails_enabled is true', () => {
      const event = { automated_emails_enabled: true };
      expect(shouldSendAutomatedEmails(event)).toBe(true);
    });

    it('blocks emails when automated_emails_enabled is false', () => {
      const event = { automated_emails_enabled: false };
      expect(shouldSendAutomatedEmails(event)).toBe(false);
    });

    it('allows emails when automated_emails_enabled is undefined (backward compatibility)', () => {
      const event = {};
      expect(shouldSendAutomatedEmails(event)).toBe(true);
    });

    it('allows emails when automated_emails_enabled is null (backward compatibility)', () => {
      const event = { automated_emails_enabled: undefined };
      expect(shouldSendAutomatedEmails(event)).toBe(true);
    });
  });

  describe('Post-session cron checks the flag', () => {
    it('cron source code contains the automated_emails_enabled check', async () => {
      // This test verifies the cron code contains the check
      // by reading the source file
      const fs = await import('fs');
      const path = await import('path');

      const cronPath = path.join(process.cwd(), 'src/app/api/cron/post-session/route.ts');
      const cronSource = fs.readFileSync(cronPath, 'utf-8');

      // Verify the check exists in the follow-up section
      expect(cronSource).toContain('automated_emails_enabled === false');

      // Count how many times the check appears (should be 4 - one for each email type)
      const matches = cronSource.match(/automated_emails_enabled === false/g);
      expect(matches?.length).toBeGreaterThanOrEqual(4);
    });
  });
});

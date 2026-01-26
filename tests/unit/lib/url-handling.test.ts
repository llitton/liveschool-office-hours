import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

/**
 * These tests verify that URL handling follows our conventions:
 * - All URLs use NEXT_PUBLIC_APP_URL environment variable
 * - No hardcoded domain fallbacks (liveschoolhelp.com, connect.liveschool.io, etc.)
 * - Client components use window.location.origin as fallback
 */

describe('URL Handling Conventions', () => {
  // Files that construct URLs and should be checked
  const apiFilesToCheck = [
    'src/app/api/bookings/route.ts',
    'src/app/api/bookings/[id]/route.ts',
    'src/app/api/cron/send-reminders/route.ts',
    'src/app/api/cron/post-session/route.ts',
    'src/app/api/admin/team/route.ts',
    'src/app/api/admin/team/[id]/resend-invite/route.ts',
    'src/app/api/polls/route.ts',
    'src/app/api/polls/[id]/book/route.ts',
    'src/app/api/one-off/route.ts',
    'src/app/api/manage/[token]/route.ts',
    'src/app/api/my-links/[token]/route.ts',
  ];

  const clientFilesToCheck = [
    'src/app/admin/EventActions.tsx',
    'src/app/admin/events/[id]/embed/page.tsx',
  ];

  // Forbidden patterns - hardcoded domains
  const forbiddenPatterns = [
    /['"`]https?:\/\/liveschoolhelp\.com/,
    /['"`]https?:\/\/connect\.liveschool\.io/,
    /['"`]https?:\/\/connect\.liveschool\.com/,
    /['"`]https?:\/\/www\.liveschoolhelp\.com/,
  ];

  // Wrong environment variable pattern
  const wrongEnvVarPattern = /process\.env\.APP_URL(?!_)/;

  describe('API Routes', () => {
    apiFilesToCheck.forEach((filePath) => {
      it(`${filePath} should not contain hardcoded domain URLs`, () => {
        const fullPath = path.join(process.cwd(), filePath);

        if (!fs.existsSync(fullPath)) {
          // Skip if file doesn't exist (might be renamed)
          return;
        }

        const content = fs.readFileSync(fullPath, 'utf-8');

        forbiddenPatterns.forEach((pattern) => {
          const match = content.match(pattern);
          expect(match).toBeNull(
            `Found hardcoded domain in ${filePath}: ${match?.[0]}. Use process.env.NEXT_PUBLIC_APP_URL instead.`
          );
        });
      });

      it(`${filePath} should use NEXT_PUBLIC_APP_URL not APP_URL`, () => {
        const fullPath = path.join(process.cwd(), filePath);

        if (!fs.existsSync(fullPath)) {
          return;
        }

        const content = fs.readFileSync(fullPath, 'utf-8');
        const match = content.match(wrongEnvVarPattern);

        expect(match).toBeNull(
          `Found wrong env var in ${filePath}: ${match?.[0]}. Use NEXT_PUBLIC_APP_URL instead.`
        );
      });
    });
  });

  describe('Client Components', () => {
    clientFilesToCheck.forEach((filePath) => {
      it(`${filePath} should not contain hardcoded domain URLs`, () => {
        const fullPath = path.join(process.cwd(), filePath);

        if (!fs.existsSync(fullPath)) {
          return;
        }

        const content = fs.readFileSync(fullPath, 'utf-8');

        forbiddenPatterns.forEach((pattern) => {
          const match = content.match(pattern);
          expect(match).toBeNull(
            `Found hardcoded domain in ${filePath}: ${match?.[0]}. Use NEXT_PUBLIC_APP_URL or window.location.origin instead.`
          );
        });
      });

      it(`${filePath} should use window.location.origin as fallback for client-side`, () => {
        const fullPath = path.join(process.cwd(), filePath);

        if (!fs.existsSync(fullPath)) {
          return;
        }

        const content = fs.readFileSync(fullPath, 'utf-8');

        // Client components should have window.location.origin somewhere if they construct URLs
        if (content.includes('NEXT_PUBLIC_APP_URL')) {
          // If using env var, should also have window.location.origin as fallback
          // or be in a server context check
          const hasWindowFallback = content.includes('window.location.origin');
          const hasTypeofCheck = content.includes("typeof window !== 'undefined'");

          expect(hasWindowFallback || hasTypeofCheck).toBe(true,
            `${filePath} uses NEXT_PUBLIC_APP_URL but should have window.location.origin fallback for client-side rendering`
          );
        }
      });
    });
  });

  describe('URL Construction Patterns', () => {
    it('should use consistent URL construction pattern in bookings route', () => {
      const filePath = path.join(process.cwd(), 'src/app/api/bookings/route.ts');

      if (!fs.existsSync(filePath)) {
        return;
      }

      const content = fs.readFileSync(filePath, 'utf-8');

      // Check that manage URLs use the correct pattern
      const manageUrlPattern = /\$\{process\.env\.NEXT_PUBLIC_APP_URL\}\/manage\//;
      expect(manageUrlPattern.test(content)).toBe(true,
        'Booking route should construct manage URLs using NEXT_PUBLIC_APP_URL'
      );
    });

    it('should use consistent URL construction pattern in reminder route', () => {
      const filePath = path.join(process.cwd(), 'src/app/api/cron/send-reminders/route.ts');

      if (!fs.existsSync(filePath)) {
        return;
      }

      const content = fs.readFileSync(filePath, 'utf-8');

      // Check that manage URLs use the correct pattern
      const manageUrlPattern = /\$\{process\.env\.NEXT_PUBLIC_APP_URL\}\/manage\//;
      expect(manageUrlPattern.test(content)).toBe(true,
        'Reminder route should construct manage URLs using NEXT_PUBLIC_APP_URL'
      );
    });

    it('should use consistent URL construction pattern in team invitation route', () => {
      const filePath = path.join(process.cwd(), 'src/app/api/admin/team/route.ts');

      if (!fs.existsSync(filePath)) {
        return;
      }

      const content = fs.readFileSync(filePath, 'utf-8');

      // Check that app URL is retrieved from env
      const appUrlPattern = /process\.env\.NEXT_PUBLIC_APP_URL/;
      expect(appUrlPattern.test(content)).toBe(true,
        'Team route should use NEXT_PUBLIC_APP_URL for invitation links'
      );
    });
  });
});

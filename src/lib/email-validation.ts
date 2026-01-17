/**
 * Email Validation Library
 * Provides DNS/MX validation and disposable email blocking
 */

import dns from 'dns';
import { promisify } from 'util';

const resolveMx = promisify(dns.resolveMx);

// Known disposable/temporary email domains
// This list covers the most common ones - add more as needed
const DISPOSABLE_DOMAINS = new Set([
  // Major disposable email services
  'mailinator.com',
  'mailinator2.com',
  'guerrillamail.com',
  'guerrillamail.net',
  'guerrillamail.org',
  'guerrillamail.biz',
  'guerrillamail.de',
  'sharklasers.com',
  'grr.la',
  'guerrillamailblock.com',
  'tempmail.com',
  'tempmail.net',
  'temp-mail.org',
  'temp-mail.io',
  '10minutemail.com',
  '10minutemail.net',
  '10minutemail.org',
  '10minmail.com',
  'minutemail.com',
  'fakeinbox.com',
  'fakemailgenerator.com',
  'trashmail.com',
  'trashmail.net',
  'trashmail.org',
  'trashmail.me',
  'trashemail.de',
  'mailnesia.com',
  'yopmail.com',
  'yopmail.fr',
  'yopmail.net',
  'cool.fr.nf',
  'jetable.fr.nf',
  'nospam.ze.tc',
  'nomail.xl.cx',
  'mega.zik.dj',
  'speed.1s.fr',
  'courriel.fr.nf',
  'moncourrier.fr.nf',
  'monemail.fr.nf',
  'monmail.fr.nf',
  'getnada.com',
  'nada.email',
  'dispostable.com',
  'mohmal.com',
  'mohmal.im',
  'mohmal.in',
  'mohmal.tech',
  'tempail.com',
  'emailondeck.com',
  'throwawaymail.com',
  'throwaway.email',
  'maildrop.cc',
  'mailsac.com',
  'burnermail.io',
  'mytemp.email',
  'tempr.email',
  'discard.email',
  'discardmail.com',
  'spamgourmet.com',
  'spamgourmet.net',
  'spamgourmet.org',
  'spam4.me',
  'spamfree24.org',
  'spamfree24.de',
  'spamfree24.info',
  'spamfree24.net',
  'getairmail.com',
  'mailcatch.com',
  'inboxalias.com',
  'incognitomail.com',
  'incognitomail.net',
  'incognitomail.org',
  'anonymbox.com',
  'anonbox.net',
  'fakeinbox.org',
  'mailnull.com',
  'e4ward.com',
  'spamex.com',
  'mytrashmail.com',
  'mt2009.com',
  'thankyou2010.com',
  'trash2009.com',
  'mt2014.com',
  'tempinbox.com',
  'tempemail.co.za',
  'tempemail.com',
  'tempemail.net',
  'tempmailo.com',
  'tempsky.com',
  'emailsensei.com',
  'guerrillamail.info',
  'imgof.com',
  'imgv.de',
  'rcpt.at',
  'trbvm.com',
  'trbvn.com',
  'klzlv.com',
  'armyspy.com',
  'cuvox.de',
  'dayrep.com',
  'einrot.com',
  'fleckens.hu',
  'gustr.com',
  'jourrapide.com',
  'rhyta.com',
  'superrito.com',
  'teleworm.us',
]);

export interface EmailValidationResult {
  valid: boolean;
  error?: string;
  errorType?: 'format' | 'disposable' | 'mx' | 'dns';
}

/**
 * Extract domain from email address
 */
export function getEmailDomain(email: string): string | null {
  const match = email.toLowerCase().match(/@([a-zA-Z0-9.-]+)$/);
  return match ? match[1] : null;
}

/**
 * Check if email domain is in disposable list
 */
export function isDisposableEmail(email: string): boolean {
  const domain = getEmailDomain(email);
  if (!domain) return false;
  return DISPOSABLE_DOMAINS.has(domain);
}

/**
 * Check if domain has valid MX records
 */
export async function hasMXRecords(domain: string): Promise<boolean> {
  try {
    const records = await resolveMx(domain);
    return records && records.length > 0;
  } catch {
    return false;
  }
}

/**
 * Full email validation (format + disposable + MX)
 * Use this for server-side validation before creating bookings
 */
export async function validateEmail(email: string): Promise<EmailValidationResult> {
  // Basic format check
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return {
      valid: false,
      error: 'Please enter a valid email address',
      errorType: 'format',
    };
  }

  const domain = getEmailDomain(email);
  if (!domain) {
    return {
      valid: false,
      error: 'Please enter a valid email address',
      errorType: 'format',
    };
  }

  // Check disposable domains
  if (isDisposableEmail(email)) {
    return {
      valid: false,
      error: 'Please use a permanent email address (temporary/disposable emails are not accepted)',
      errorType: 'disposable',
    };
  }

  // Check MX records
  try {
    const hasMx = await hasMXRecords(domain);
    if (!hasMx) {
      return {
        valid: false,
        error: 'This email domain doesn\'t appear to accept emails. Please check for typos.',
        errorType: 'mx',
      };
    }
  } catch {
    // If DNS lookup fails, we'll allow it through (benefit of the doubt)
    // Server-side validation will catch bounces
  }

  return { valid: true };
}

/**
 * Quick validation (format + disposable only, no DNS lookup)
 * Use this for real-time feedback on the client side
 */
export function validateEmailQuick(email: string): EmailValidationResult {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return {
      valid: false,
      error: 'Please enter a valid email address',
      errorType: 'format',
    };
  }

  if (isDisposableEmail(email)) {
    return {
      valid: false,
      error: 'Please use a permanent email address (temporary/disposable emails are not accepted)',
      errorType: 'disposable',
    };
  }

  return { valid: true };
}

/**
 * Get list of disposable domains (for debugging/admin purposes)
 */
export function getDisposableDomainCount(): number {
  return DISPOSABLE_DOMAINS.size;
}

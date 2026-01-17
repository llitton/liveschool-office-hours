import { NextRequest, NextResponse } from 'next/server';
import { validateEmail, validateEmailQuick } from '@/lib/email-validation';

/**
 * POST /api/validate/email
 * Validates an email address for format, disposable domains, and MX records
 *
 * Body: { email: string, quick?: boolean }
 * - quick: true = skip MX check (faster, for real-time feedback)
 * - quick: false/undefined = full validation including MX check
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, quick } = body;

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { valid: false, error: 'Email is required', errorType: 'format' },
        { status: 400 }
      );
    }

    // Trim and lowercase
    const cleanEmail = email.trim().toLowerCase();

    // Quick validation (no DNS) for real-time feedback
    if (quick) {
      const result = validateEmailQuick(cleanEmail);
      return NextResponse.json(result);
    }

    // Full validation with MX check
    const result = await validateEmail(cleanEmail);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Email validation error:', error);
    return NextResponse.json(
      { valid: false, error: 'Validation failed', errorType: 'format' },
      { status: 500 }
    );
  }
}

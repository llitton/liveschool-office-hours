/**
 * Error handling utilities for user-friendly error messages
 *
 * This module provides utilities for:
 * 1. Sanitizing database error messages (removing internal details)
 * 2. Mapping Supabase error codes to user-friendly messages
 * 3. Creating standardized error responses
 */

// Map of Supabase/PostgreSQL error codes to user-friendly messages
const POSTGRES_ERROR_MAP: Record<string, string> = {
  // Constraint violations
  '23505': 'This record already exists. Please try with different values.',
  '23503': 'This operation references data that no longer exists.',
  '23514': 'The provided values are not valid for this field.',
  '23502': 'Required information is missing. Please fill in all required fields.',

  // Authentication/Authorization
  '42501': 'You do not have permission to perform this action.',
  '28000': 'Authentication failed. Please log in again.',
  '28P01': 'Authentication failed. Please check your credentials.',

  // Connection/Resource issues
  '53000': 'The system is currently under heavy load. Please try again.',
  '53100': 'The system is out of resources. Please try again later.',
  '53200': 'The operation was interrupted. Please try again.',
  '53300': 'Too many connections. Please try again in a moment.',

  // Data issues
  '22001': 'The text entered is too long for this field.',
  '22003': 'The number entered is out of range for this field.',
  '22007': 'The date format is invalid. Please use a valid date.',
  '22008': 'The date/time value is out of range.',
  '22012': 'Division by zero is not allowed.',
  '22P02': 'Invalid input format. Please check your data.',

  // Timeouts
  '57014': 'The operation took too long. Please try again.',
};

// Common error message patterns to sanitize
const SANITIZE_PATTERNS = [
  // Remove SQL details
  { pattern: /row_to_json:\s*.*/i, replacement: '' },
  { pattern: /violates\s+\w+\s+constraint\s+"[^"]+"/i, replacement: 'data validation failed' },
  { pattern: /Key\s+\([^)]+\)\s*=\s*\([^)]+\)/i, replacement: '' },
  { pattern: /DETAIL:\s*.*/i, replacement: '' },
  { pattern: /HINT:\s*.*/i, replacement: '' },
  { pattern: /CONTEXT:\s*.*/i, replacement: '' },

  // Remove table/column names
  { pattern: /column\s+"[^"]+"/gi, replacement: 'field' },
  { pattern: /table\s+"[^"]+"/gi, replacement: 'record' },
  { pattern: /relation\s+"[^"]+"/gi, replacement: 'data' },

  // Remove technical details
  { pattern: /\(SQLSTATE\s+\d+\)/gi, replacement: '' },
  { pattern: /at\s+character\s+\d+/gi, replacement: '' },
];

export interface SupabaseError {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
}

/**
 * Sanitize an error message to remove database/infrastructure details
 */
export function sanitizeErrorMessage(message: string): string {
  let sanitized = message;

  for (const { pattern, replacement } of SANITIZE_PATTERNS) {
    sanitized = sanitized.replace(pattern, replacement);
  }

  // Clean up any double spaces or trailing punctuation issues
  sanitized = sanitized.replace(/\s+/g, ' ').trim();

  // If the message is now empty or too short, use a generic message
  if (sanitized.length < 10) {
    return 'An error occurred. Please try again.';
  }

  return sanitized;
}

/**
 * Get a user-friendly error message from a Supabase error
 */
export function getUserFriendlyError(error: SupabaseError): string {
  // Check if we have a specific message for this error code
  if (error.code && POSTGRES_ERROR_MAP[error.code]) {
    return POSTGRES_ERROR_MAP[error.code];
  }

  // If there's a message, try to sanitize it
  if (error.message) {
    return sanitizeErrorMessage(error.message);
  }

  // Default fallback
  return 'An unexpected error occurred. Please try again.';
}

/**
 * Standard error response format for API routes
 */
export interface ApiError {
  error: string;
  code?: string;
  details?: string;
}

/**
 * Create a standardized API error response
 * Only includes code/details in development mode for debugging
 */
export function createApiError(
  error: SupabaseError | Error | unknown,
  fallbackMessage = 'An error occurred'
): ApiError {
  const isDev = process.env.NODE_ENV === 'development';

  // Handle Supabase errors
  if (error && typeof error === 'object' && 'code' in error) {
    const supabaseError = error as SupabaseError;
    return {
      error: getUserFriendlyError(supabaseError),
      ...(isDev && supabaseError.code && { code: supabaseError.code }),
      ...(isDev && supabaseError.details && { details: supabaseError.details }),
    };
  }

  // Handle standard Error objects
  if (error instanceof Error) {
    return {
      error: sanitizeErrorMessage(error.message) || fallbackMessage,
    };
  }

  // Handle unknown errors
  return {
    error: fallbackMessage,
  };
}

/**
 * Common user-friendly error messages for specific scenarios
 */
export const CommonErrors = {
  UNAUTHORIZED: 'Please log in to continue.',
  FORBIDDEN: 'You do not have permission to perform this action.',
  NOT_FOUND: 'The requested resource was not found.',
  RATE_LIMITED: 'Too many requests. Please wait a moment and try again.',
  NETWORK_ERROR: 'Unable to connect. Please check your internet connection.',
  SERVER_ERROR: 'Something went wrong on our end. Please try again.',
  VALIDATION_ERROR: 'Please check your input and try again.',
  SLOT_FULL: 'This time slot is no longer available.',
  SLOT_CONFLICT: 'This time conflicts with another event.',
  BOOKING_EXISTS: 'You have already booked this session.',
  TOKEN_EXPIRED: 'Your session has expired. Please log in again.',
  CALENDAR_ERROR: 'Unable to sync with your calendar. The booking was saved.',
  EMAIL_ERROR: 'Unable to send confirmation email. Please check your bookings.',
};

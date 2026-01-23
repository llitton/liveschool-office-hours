/**
 * Structured logging utility for application monitoring and debugging
 *
 * Provides consistent log format with context for:
 * - Calendar integration operations
 * - Email sending operations
 * - HubSpot sync operations
 * - SMS operations
 * - Booking flow operations
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  // Operation identification
  operation: string;
  component?: string;

  // Entity identifiers
  bookingId?: string;
  eventId?: string;
  slotId?: string;
  adminId?: string;
  attendeeEmail?: string;

  // Additional metadata
  metadata?: Record<string, unknown>;
}

export interface LogEntry extends LogContext {
  level: LogLevel;
  message: string;
  timestamp: string;
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string | number;
  };
  duration?: number;
}

/**
 * Format error object for logging (removes circular references)
 */
function formatError(error: unknown): LogEntry['error'] | undefined {
  if (!error) return undefined;

  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: (error as Error & { code?: string | number }).code,
    };
  }

  if (typeof error === 'object') {
    const errorObj = error as Record<string, unknown>;
    return {
      name: String(errorObj.name || 'UnknownError'),
      message: String(errorObj.message || JSON.stringify(error)),
      code: errorObj.code as string | number | undefined,
    };
  }

  return {
    name: 'UnknownError',
    message: String(error),
  };
}

/**
 * Create a structured log entry
 */
function createLogEntry(
  level: LogLevel,
  message: string,
  context: LogContext,
  error?: unknown,
  duration?: number
): LogEntry {
  return {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...context,
    ...(error ? { error: formatError(error) } : {}),
    ...(duration !== undefined ? { duration } : {}),
  };
}

/**
 * Output log entry to console with appropriate method
 */
function outputLog(entry: LogEntry): void {
  const logMethod = entry.level === 'error' ? console.error
    : entry.level === 'warn' ? console.warn
    : entry.level === 'debug' ? console.debug
    : console.log;

  // In production, output JSON for structured log aggregation
  // In development, use more readable format
  if (process.env.NODE_ENV === 'production') {
    logMethod(JSON.stringify(entry));
  } else {
    const prefix = `[${entry.level.toUpperCase()}] [${entry.operation}]`;
    const identifiers = [
      entry.bookingId && `booking=${entry.bookingId}`,
      entry.eventId && `event=${entry.eventId}`,
      entry.slotId && `slot=${entry.slotId}`,
      entry.adminId && `admin=${entry.adminId}`,
      entry.attendeeEmail && `attendee=${entry.attendeeEmail}`,
    ].filter(Boolean).join(' ');

    logMethod(
      `${prefix} ${entry.message}`,
      identifiers ? `| ${identifiers}` : '',
      entry.error ? `| Error: ${entry.error.message}` : '',
      entry.duration !== undefined ? `| Duration: ${entry.duration}ms` : ''
    );

    if (entry.error?.stack && entry.level === 'error') {
      logMethod('Stack:', entry.error.stack);
    }
  }
}

/**
 * Logger class for consistent structured logging
 */
class Logger {
  private context: Partial<LogContext>;

  constructor(context: Partial<LogContext> = {}) {
    this.context = context;
  }

  /**
   * Create a child logger with additional context
   */
  child(additionalContext: Partial<LogContext>): Logger {
    return new Logger({ ...this.context, ...additionalContext });
  }

  debug(message: string, context: Partial<LogContext> = {}): void {
    if (process.env.NODE_ENV === 'production') return; // Skip debug in production
    const entry = createLogEntry('debug', message, {
      operation: 'unknown',
      ...this.context,
      ...context,
    });
    outputLog(entry);
  }

  info(message: string, context: Partial<LogContext> = {}): void {
    const entry = createLogEntry('info', message, {
      operation: 'unknown',
      ...this.context,
      ...context,
    });
    outputLog(entry);
  }

  warn(message: string, context: Partial<LogContext> = {}, error?: unknown): void {
    const entry = createLogEntry('warn', message, {
      operation: 'unknown',
      ...this.context,
      ...context,
    }, error);
    outputLog(entry);
  }

  error(message: string, context: Partial<LogContext> = {}, error?: unknown): void {
    const entry = createLogEntry('error', message, {
      operation: 'unknown',
      ...this.context,
      ...context,
    }, error);
    outputLog(entry);
  }

  /**
   * Log a successful operation with duration
   */
  success(message: string, context: Partial<LogContext> = {}, duration?: number): void {
    const entry = createLogEntry('info', message, {
      operation: 'unknown',
      ...this.context,
      ...context,
    }, undefined, duration);
    outputLog(entry);
  }

  /**
   * Log a failed operation with error details
   */
  failure(message: string, context: Partial<LogContext> = {}, error?: unknown, duration?: number): void {
    const entry = createLogEntry('error', message, {
      operation: 'unknown',
      ...this.context,
      ...context,
    }, error, duration);
    outputLog(entry);
  }
}

// Pre-configured loggers for different components
export const calendarLogger = new Logger({ component: 'calendar' });
export const emailLogger = new Logger({ component: 'email' });
export const hubspotLogger = new Logger({ component: 'hubspot' });
export const smsLogger = new Logger({ component: 'sms' });
export const bookingLogger = new Logger({ component: 'booking' });
export const slotLogger = new Logger({ component: 'slot' });

// Default logger
export const logger = new Logger();

/**
 * Helper to time an async operation and log result
 */
export async function logOperation<T>(
  operation: string,
  context: Partial<LogContext>,
  fn: () => Promise<T>,
  logger: Logger = new Logger()
): Promise<T> {
  const startTime = Date.now();
  const opContext = { operation, ...context };

  try {
    const result = await fn();
    const duration = Date.now() - startTime;
    logger.success(`${operation} completed`, opContext, duration);
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.failure(`${operation} failed`, opContext, error, duration);
    throw error;
  }
}

export default logger;

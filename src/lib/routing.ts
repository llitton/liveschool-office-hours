import { OHRoutingRule } from '@/types';

/**
 * Evaluate routing rules against form responses to determine target event and host.
 * Rules are sorted by priority (lower = higher priority).
 * First matching rule wins. If no rules match, returns the default event.
 */
export function evaluateRules(
  rules: OHRoutingRule[],
  responses: Record<string, string>,
  defaultEventId: string | null
): { eventId: string | null; hostId: string | null } {
  // Sort rules by priority (lower = higher priority)
  const sortedRules = rules
    .filter((r) => r.is_active)
    .sort((a, b) => a.priority - b.priority);

  // Find first matching rule
  for (const rule of sortedRules) {
    const response = responses[rule.question_id]?.trim().toLowerCase();
    const target = rule.answer_value.trim().toLowerCase();

    if (response === target) {
      return {
        eventId: rule.target_event_id,
        hostId: rule.target_host_id,
      };
    }
  }

  // Return default if no rule matches
  return { eventId: defaultEventId, hostId: null };
}

/**
 * Encode form responses for URL transmission.
 * Used to prefill booking form with routing form answers.
 */
export function encodeResponses(responses: Record<string, string>): string {
  return btoa(JSON.stringify(responses));
}

/**
 * Decode prefilled responses from URL parameter.
 */
export function decodeResponses(encoded: string): Record<string, string> | null {
  try {
    return JSON.parse(atob(encoded));
  } catch {
    return null;
  }
}

/**
 * Generate a slug from a name.
 */
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

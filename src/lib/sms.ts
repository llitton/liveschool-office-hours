/**
 * SMS Library Module
 * Handles SMS configuration, sending, and phone validation
 */

import { parsePhoneNumber, isValidPhoneNumber } from 'libphonenumber-js';
import { getServiceSupabase } from './supabase';
import { createSMSProvider, type SMSProviderInterface } from './sms-providers';
import type { OHSMSConfig, SMSProvider } from '@/types';

// Default SMS templates (kept under 160 characters)
export const defaultSMSTemplates = {
  reminder_24h: "Hi {{first_name}}, reminder: {{event_name}} tomorrow at {{time_with_timezone}}. Reply STOP to opt out.",
  reminder_1h: "Hi {{first_name}}, your {{event_name}} session starts in 1 hour at {{time_with_timezone}}.",
};

/**
 * Get the active SMS configuration
 */
export async function getSMSConfig(): Promise<OHSMSConfig | null> {
  const supabase = getServiceSupabase();

  const { data, error } = await supabase
    .from('oh_sms_config')
    .select('*')
    .eq('is_active', true)
    .single();

  if (error || !data) {
    return null;
  }

  return data as OHSMSConfig;
}

/**
 * Save SMS configuration
 */
export async function saveSMSConfig(config: {
  provider: SMSProvider;
  api_key: string;
  api_secret?: string | null;
  sender_phone?: string | null;
}): Promise<boolean> {
  const supabase = getServiceSupabase();

  // Deactivate any existing config
  await supabase
    .from('oh_sms_config')
    .update({ is_active: false })
    .eq('is_active', true);

  // Insert new config
  const { error } = await supabase
    .from('oh_sms_config')
    .insert({
      provider: config.provider,
      api_key: config.api_key,
      api_secret: config.api_secret || null,
      sender_phone: config.sender_phone || null,
      is_active: true,
    });

  return !error;
}

/**
 * Deactivate SMS configuration (disconnect)
 */
export async function deactivateSMSConfig(): Promise<boolean> {
  const supabase = getServiceSupabase();

  const { error } = await supabase
    .from('oh_sms_config')
    .update({ is_active: false })
    .eq('is_active', true);

  return !error;
}

/**
 * Send an SMS message
 */
export async function sendSMS(to: string, message: string): Promise<boolean> {
  const config = await getSMSConfig();

  if (!config) {
    console.error('SMS: No active configuration found');
    return false;
  }

  try {
    const provider = createSMSProvider(config);
    return await provider.sendSMS(to, message);
  } catch (error) {
    console.error('SMS sending error:', error);
    return false;
  }
}

/**
 * Test SMS connection with current or provided config
 */
export async function testSMSConnection(config?: OHSMSConfig): Promise<boolean> {
  const activeConfig = config || await getSMSConfig();

  if (!activeConfig) {
    return false;
  }

  try {
    const provider = createSMSProvider(activeConfig);
    return await provider.testConnection();
  } catch (error) {
    console.error('SMS connection test error:', error);
    return false;
  }
}

/**
 * Format a phone number to E.164 format
 * @param phone - The phone number to format
 * @param defaultCountry - Default country code (default: 'US')
 * @returns E.164 formatted phone number or null if invalid
 */
export function formatPhoneE164(phone: string, defaultCountry: string = 'US'): string | null {
  try {
    // Clean up the input
    const cleaned = phone.trim();

    if (!cleaned) {
      return null;
    }

    // Try to parse the phone number
    const phoneNumber = parsePhoneNumber(cleaned, defaultCountry as never);

    if (phoneNumber && phoneNumber.isValid()) {
      return phoneNumber.format('E.164');
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Validate a phone number
 */
export function validatePhoneNumber(phone: string, defaultCountry: string = 'US'): boolean {
  try {
    const cleaned = phone.trim();
    if (!cleaned) return false;

    return isValidPhoneNumber(cleaned, defaultCountry as never);
  } catch {
    return false;
  }
}

/**
 * Process an SMS template with variables
 */
export function processSMSTemplate(
  template: string,
  variables: Record<string, string | undefined>
): string {
  let result = template;

  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`{{${key}}}`, 'g');
    result = result.replace(regex, value || '');
  }

  return result;
}

/**
 * Check if SMS is configured and active
 */
export async function isSMSConfigured(): Promise<boolean> {
  const config = await getSMSConfig();
  return config !== null && config.is_active;
}

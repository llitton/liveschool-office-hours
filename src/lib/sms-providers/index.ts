/**
 * SMS Provider Factory
 * Creates the appropriate SMS provider based on configuration
 */

import type { OHSMSConfig } from '@/types';
import { AircallProvider, type SMSProviderInterface } from './aircall';
import { TwilioProvider } from './twilio';

export type { SMSProviderInterface };

export function createSMSProvider(config: OHSMSConfig): SMSProviderInterface {
  switch (config.provider) {
    case 'aircall':
      return new AircallProvider(config);
    case 'twilio':
      return new TwilioProvider(config);
    case 'messagebird':
      // MessageBird can be added later
      throw new Error('MessageBird provider not yet implemented');
    default:
      throw new Error(`Unknown SMS provider: ${config.provider}`);
  }
}

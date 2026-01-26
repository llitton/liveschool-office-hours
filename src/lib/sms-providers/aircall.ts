/**
 * Aircall SMS Provider
 * https://developer.aircall.io/api-references/#send-an-sms
 */

import type { OHSMSConfig } from '@/types';
import { smsLogger } from '@/lib/logger';

export interface SMSProviderInterface {
  sendSMS(to: string, message: string): Promise<boolean>;
  testConnection(): Promise<boolean>;
}

export class AircallProvider implements SMSProviderInterface {
  private apiKey: string;
  private apiSecret: string | null;
  private senderPhone: string | null;

  constructor(config: OHSMSConfig) {
    this.apiKey = config.api_key;
    this.apiSecret = config.api_secret;
    this.senderPhone = config.sender_phone;
  }

  private getAuthHeader(): string {
    // Aircall uses Basic Auth with API ID:API Token
    if (this.apiSecret) {
      const credentials = Buffer.from(`${this.apiKey}:${this.apiSecret}`).toString('base64');
      return `Basic ${credentials}`;
    }
    return `Bearer ${this.apiKey}`;
  }

  async sendSMS(to: string, message: string): Promise<boolean> {
    try {
      // Aircall SMS requires a number ID, not just a phone number
      // First, we need to find the number ID for our sender phone
      let numberId = this.senderPhone;

      // If senderPhone looks like a phone number (not an ID), try to find the number ID
      if (this.senderPhone && this.senderPhone.startsWith('+')) {
        const numbersResponse = await fetch('https://api.aircall.io/v1/numbers', {
          method: 'GET',
          headers: {
            'Authorization': this.getAuthHeader(),
          },
        });

        if (numbersResponse.ok) {
          const numbersData = await numbersResponse.json();
          const matchingNumber = numbersData.numbers?.find(
            (n: { direct_link: string; id: number; is_sms_enabled?: boolean }) =>
              n.direct_link === this.senderPhone ||
              n.direct_link?.replace(/\D/g, '') === this.senderPhone?.replace(/\D/g, '')
          );
          if (matchingNumber) {
            numberId = String(matchingNumber.id);
            smsLogger.debug('Found Aircall number', {
              operation: 'aircall.sendSMS',
              metadata: { numberId, smsEnabled: matchingNumber.is_sms_enabled },
            });
          }
        }
      }

      if (!numberId) {
        console.error('Aircall SMS error: No sender number configured');
        return false;
      }

      // Aircall SMS endpoint: POST /v1/numbers/{number_id}/messages
      const response = await fetch(`https://api.aircall.io/v1/numbers/${numberId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': this.getAuthHeader(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: to,
          body: message,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Aircall SMS error:', response.status, errorText);
        return false;
      }

      const result = await response.json();
      smsLogger.info('Aircall SMS sent', {
        operation: 'aircall.sendSMS',
        metadata: { messageId: result?.id },
      });
      return true;
    } catch (error) {
      console.error('Aircall SMS error:', error);
      return false;
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      // Test API connection by fetching user info
      const response = await fetch('https://api.aircall.io/v1/company', {
        method: 'GET',
        headers: {
          'Authorization': this.getAuthHeader(),
        },
      });

      return response.ok;
    } catch (error) {
      console.error('Aircall connection test error:', error);
      return false;
    }
  }
}

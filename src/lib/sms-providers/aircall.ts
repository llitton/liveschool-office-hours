/**
 * Aircall SMS Provider
 * https://developer.aircall.io/api-references/#send-an-sms
 */

import type { OHSMSConfig } from '@/types';

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
      // Aircall SMS endpoint
      // Note: Aircall's SMS functionality may require a specific number setup
      const response = await fetch('https://api.aircall.io/v1/calls/sms', {
        method: 'POST',
        headers: {
          'Authorization': this.getAuthHeader(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: to,
          from: this.senderPhone,
          body: message,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        console.error('Aircall SMS error:', error);
        return false;
      }

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

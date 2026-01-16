/**
 * Twilio SMS Provider
 * https://www.twilio.com/docs/sms/api/message-resource
 */

import type { OHSMSConfig } from '@/types';
import type { SMSProviderInterface } from './aircall';

export class TwilioProvider implements SMSProviderInterface {
  private accountSid: string;
  private authToken: string;
  private senderPhone: string | null;

  constructor(config: OHSMSConfig) {
    this.accountSid = config.api_key; // Account SID
    this.authToken = config.api_secret || ''; // Auth Token
    this.senderPhone = config.sender_phone;
  }

  private getAuthHeader(): string {
    const credentials = Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64');
    return `Basic ${credentials}`;
  }

  async sendSMS(to: string, message: string): Promise<boolean> {
    if (!this.senderPhone) {
      console.error('Twilio: No sender phone number configured');
      return false;
    }

    try {
      const response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`,
        {
          method: 'POST',
          headers: {
            'Authorization': this.getAuthHeader(),
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            To: to,
            From: this.senderPhone,
            Body: message,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        console.error('Twilio SMS error:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Twilio SMS error:', error);
      return false;
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}.json`,
        {
          method: 'GET',
          headers: {
            'Authorization': this.getAuthHeader(),
          },
        }
      );

      return response.ok;
    } catch (error) {
      console.error('Twilio connection test error:', error);
      return false;
    }
  }
}

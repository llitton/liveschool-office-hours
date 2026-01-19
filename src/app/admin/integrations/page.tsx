'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { PageContainer, PageHeader } from '@/components/AppShell';

interface HubSpotStatus {
  connected: boolean;
  portalId?: string;
  connectedAt?: string;
}

interface SlackStatus {
  connected: boolean;
  webhookConfigured?: boolean;
}

interface SMSStatus {
  connected: boolean;
  provider?: string;
  sender_phone?: string;
}

function IntegrationsContent() {
  const searchParams = useSearchParams();
  const [hubspotStatus, setHubspotStatus] = useState<HubSpotStatus | null>(null);
  const [slackStatus, setSlackStatus] = useState<SlackStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // HubSpot Private App token
  const [hubspotToken, setHubspotToken] = useState('');
  const [savingHubspot, setSavingHubspot] = useState(false);

  // Slack webhook form
  const [slackWebhook, setSlackWebhook] = useState('');
  const [slackChannel, setSlackChannel] = useState('');
  const [savingSlack, setSavingSlack] = useState(false);
  const [showSlackSetup, setShowSlackSetup] = useState(false);
  const [testingSlack, setTestingSlack] = useState(false);

  // SMS config
  const [smsStatus, setSmsStatus] = useState<SMSStatus | null>(null);
  const [smsProvider, setSmsProvider] = useState<'aircall' | 'twilio'>('aircall');
  const [smsApiKey, setSmsApiKey] = useState('');
  const [smsApiSecret, setSmsApiSecret] = useState('');
  const [smsSenderPhone, setSmsSenderPhone] = useState('');
  const [savingSms, setSavingSms] = useState(false);
  const [showSmsSetup, setShowSmsSetup] = useState(false);
  const [testingSms, setTestingSms] = useState(false);
  const [testSmsPhone, setTestSmsPhone] = useState('');

  useEffect(() => {
    fetchStatuses();

    // Check for success/error from OAuth redirect
    const success = searchParams.get('success');
    const error = searchParams.get('error');

    if (success === 'hubspot') {
      setMessage({ type: 'success', text: 'HubSpot connected successfully!' });
    } else if (error) {
      const errorMessages: Record<string, string> = {
        config: 'HubSpot is not configured. Please check environment variables.',
        token: 'Failed to authenticate with HubSpot. Please try again.',
        save: 'Failed to save HubSpot configuration.',
        unknown: 'An unexpected error occurred.',
      };
      setMessage({ type: 'error', text: errorMessages[error] || errorMessages.unknown });
    }
  }, [searchParams]);

  const fetchStatuses = async () => {
    try {
      const [hubspotRes, slackRes, smsRes] = await Promise.all([
        fetch('/api/hubspot/auth', { method: 'POST' }),
        fetch('/api/slack/status'),
        fetch('/api/sms/status'),
      ]);

      if (hubspotRes.ok) {
        const data = await hubspotRes.json();
        setHubspotStatus(data);
      }

      if (slackRes.ok) {
        const data = await slackRes.json();
        setSlackStatus(data);
        if (data.webhook_url) {
          setSlackWebhook(data.webhook_url);
        }
        if (data.default_channel) {
          setSlackChannel(data.default_channel);
        }
      } else {
        setSlackStatus({ connected: false });
      }

      if (smsRes.ok) {
        const data = await smsRes.json();
        setSmsStatus(data);
      } else {
        setSmsStatus({ connected: false });
      }
    } catch (err) {
      console.error('Failed to fetch integration statuses:', err);
    } finally {
      setLoading(false);
    }
  };

  const saveHubSpotToken = async () => {
    if (!hubspotToken.trim()) return;

    setSavingHubspot(true);
    try {
      const response = await fetch('/api/hubspot/auth', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: hubspotToken.trim() }),
      });

      if (response.ok) {
        const data = await response.json();
        setHubspotStatus({ connected: true, connectedAt: new Date().toISOString() });
        setHubspotToken('');
        setMessage({ type: 'success', text: 'HubSpot connected successfully!' });
      } else {
        const data = await response.json();
        setMessage({ type: 'error', text: data.error || 'Failed to connect HubSpot' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to save HubSpot token' });
    } finally {
      setSavingHubspot(false);
    }
  };

  const disconnectHubSpot = async () => {
    setDisconnecting(true);
    try {
      const response = await fetch('/api/hubspot/auth', { method: 'DELETE' });
      if (response.ok) {
        setHubspotStatus({ connected: false });
        setMessage({ type: 'success', text: 'HubSpot disconnected' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to disconnect HubSpot' });
    } finally {
      setDisconnecting(false);
    }
  };

  const saveSlackConfig = async () => {
    setSavingSlack(true);
    try {
      const response = await fetch('/api/slack/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          webhook_url: slackWebhook,
          default_channel: slackChannel,
        }),
      });

      if (response.ok) {
        setSlackStatus({ connected: true, webhookConfigured: true });
        setMessage({ type: 'success', text: 'Slack configuration saved!' });
        setShowSlackSetup(false);
      } else {
        const data = await response.json();
        setMessage({ type: 'error', text: data.error || 'Failed to save Slack config' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to save Slack configuration' });
    } finally {
      setSavingSlack(false);
    }
  };

  const testSlackConnection = async () => {
    setTestingSlack(true);
    try {
      const response = await fetch('/api/slack/test', { method: 'POST' });
      if (response.ok) {
        setMessage({ type: 'success', text: 'Test message sent! Check your Slack channel.' });
      } else {
        const data = await response.json();
        setMessage({ type: 'error', text: data.error || 'Failed to send test message' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to send test message' });
    } finally {
      setTestingSlack(false);
    }
  };

  const saveSmsConfig = async () => {
    if (!smsApiKey.trim()) return;

    setSavingSms(true);
    try {
      const response = await fetch('/api/sms/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: smsProvider,
          api_key: smsApiKey,
          api_secret: smsApiSecret || undefined,
          sender_phone: smsSenderPhone || undefined,
        }),
      });

      if (response.ok) {
        setSmsStatus({ connected: true, provider: smsProvider, sender_phone: smsSenderPhone });
        setSmsApiKey('');
        setSmsApiSecret('');
        setMessage({ type: 'success', text: 'SMS provider connected successfully!' });
        setShowSmsSetup(false);
      } else {
        const data = await response.json();
        setMessage({ type: 'error', text: data.error || 'Failed to connect SMS provider' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to save SMS configuration' });
    } finally {
      setSavingSms(false);
    }
  };

  const disconnectSms = async () => {
    try {
      const response = await fetch('/api/sms/config', { method: 'DELETE' });
      if (response.ok) {
        setSmsStatus({ connected: false });
        setMessage({ type: 'success', text: 'SMS provider disconnected' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to disconnect SMS provider' });
    }
  };

  const testSmsConnection = async () => {
    if (!testSmsPhone.trim()) {
      setMessage({ type: 'error', text: 'Please enter a phone number to test' });
      return;
    }

    setTestingSms(true);
    try {
      const response = await fetch('/api/sms/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: testSmsPhone }),
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'Test SMS sent! Check your phone.' });
        setTestSmsPhone('');
      } else {
        const data = await response.json();
        setMessage({ type: 'error', text: data.error || 'Failed to send test SMS' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to send test SMS' });
    } finally {
      setTestingSms(false);
    }
  };

  if (loading) {
    return (
      <PageContainer narrow>
        <PageHeader
          title="Integrations"
          description="Connect external services to enhance your scheduling"
        />
        <div className="bg-white rounded-xl p-6 animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-48 mb-4" />
          <div className="h-32 bg-gray-100 rounded" />
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer narrow>
      <PageHeader
        title="Integrations"
        description="Connect external services to enhance your scheduling"
      />

        {message && (
          <div
            className={`p-4 rounded-lg mb-6 text-sm ${
              message.type === 'success'
                ? 'bg-green-50 text-green-700'
                : 'bg-red-50 text-red-700'
            }`}
          >
            {message.text}
          </div>
        )}

        {/* HubSpot Integration */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-[#ff7a59] rounded-lg flex items-center justify-center text-white font-bold">
              HS
            </div>
            <div className="flex-1">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-[#101E57]">HubSpot</h2>
                  <p className="text-sm text-[#667085] mt-1">
                    Keep your CRM up-to-date automatically - every conversation gets logged
                  </p>
                </div>
                {hubspotStatus?.connected && (
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1 text-sm text-green-600">
                      <span className="w-2 h-2 bg-green-500 rounded-full" />
                      Connected
                    </span>
                    <button
                      onClick={disconnectHubSpot}
                      disabled={disconnecting}
                      className="text-red-600 hover:text-red-700 text-sm font-medium ml-4"
                    >
                      {disconnecting ? 'Disconnecting...' : 'Disconnect'}
                    </button>
                  </div>
                )}
              </div>

              {!hubspotStatus?.connected && (
                <div className="mt-4">
                  {/* Benefits preview */}
                  <div className="bg-gradient-to-r from-[#fff5f3] to-[#fff9f7] border border-[#ffd6cc] rounded-lg p-4 mb-4">
                    <p className="text-sm font-medium text-[#101E57] mb-2">When you connect HubSpot, you&apos;ll be able to:</p>
                    <ul className="text-sm text-[#667085] space-y-2">
                      <li className="flex items-start gap-2">
                        <span className="text-[#ff7a59] mt-0.5">&#10003;</span>
                        <span>See each attendee&apos;s full CRM history before your session</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-[#ff7a59] mt-0.5">&#10003;</span>
                        <span>Auto-log meetings so nothing gets lost</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-[#ff7a59] mt-0.5">&#10003;</span>
                        <span>Create follow-up tasks with one click during sessions</span>
                      </li>
                    </ul>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-[#101E57] mb-1">
                        Private App Access Token
                      </label>
                      <input
                        type="password"
                        value={hubspotToken}
                        onChange={(e) => setHubspotToken(e.target.value)}
                        placeholder="pat-na1-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57]"
                      />
                      <p className="text-xs text-[#667085] mt-1">
                        Find this in HubSpot → Settings → Integrations → Private Apps → Your App → Auth
                      </p>
                    </div>
                    <button
                      onClick={saveHubSpotToken}
                      disabled={!hubspotToken.trim() || savingHubspot}
                      className="bg-[#ff7a59] text-white px-4 py-2 rounded-lg hover:bg-[#e66b4d] transition font-medium text-sm disabled:opacity-50"
                    >
                      {savingHubspot ? 'Connecting...' : 'Connect HubSpot'}
                    </button>
                  </div>
                </div>
              )}

              {hubspotStatus?.connected && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  {hubspotStatus.connectedAt && (
                    <p className="text-sm text-[#667085] mb-4">
                      Connected: {new Date(hubspotStatus.connectedAt).toLocaleDateString()}
                    </p>
                  )}
                  <div className="bg-gradient-to-r from-[#fff5f3] to-[#fff9f7] border border-[#ffd6cc] rounded-lg p-4">
                    <h3 className="font-medium text-[#101E57] mb-3">Working for you:</h3>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-[#ff7a59]">&#10003;</span>
                        <span className="text-[#667085]">Contacts auto-synced</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[#ff7a59]">&#10003;</span>
                        <span className="text-[#667085]">Meetings auto-logged</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[#ff7a59]">&#10003;</span>
                        <span className="text-[#667085]">One-click tasks</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[#ff7a59]">&#10003;</span>
                        <span className="text-[#667085]">CRM context in sessions</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Slack Integration */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-[#4A154B] rounded-lg flex items-center justify-center text-white font-bold">
              S
            </div>
            <div className="flex-1">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-[#101E57]">Slack</h2>
                  <p className="text-sm text-[#667085] mt-1">
                    Never miss a booking - get instant notifications in your team channel
                  </p>
                </div>
                {slackStatus?.connected && (
                  <span className="flex items-center gap-1 text-sm text-green-600">
                    <span className="w-2 h-2 bg-green-500 rounded-full" />
                    Connected
                  </span>
                )}
              </div>

              {!slackStatus?.connected && !showSlackSetup && (
                <div className="mt-4">
                  {/* Benefits preview */}
                  <div className="bg-gradient-to-r from-[#f3f0f4] to-[#f9f7fa] border border-[#d9c8e0] rounded-lg p-4 mb-4">
                    <p className="text-sm font-medium text-[#101E57] mb-2">Stay in the loop with your team:</p>
                    <ul className="text-sm text-[#667085] space-y-2">
                      <li className="flex items-start gap-2">
                        <span className="text-[#4A154B] mt-0.5">&#10003;</span>
                        <span>Get notified instantly when someone books a session</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-[#4A154B] mt-0.5">&#10003;</span>
                        <span>Daily digest of your upcoming sessions at 7am</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-[#4A154B] mt-0.5">&#10003;</span>
                        <span>Post-session summaries to share learnings with your team</span>
                      </li>
                    </ul>
                  </div>

                  <button
                    onClick={() => setShowSlackSetup(true)}
                    className="bg-[#4A154B] text-white px-4 py-2 rounded-lg hover:bg-[#3c1040] transition font-medium text-sm"
                  >
                    Set Up Slack
                  </button>
                </div>
              )}

              {!slackStatus?.connected && showSlackSetup && (
                <div className="mt-4">
                  {/* Step-by-step setup guide */}
                  <div className="bg-[#F6F6F9] rounded-lg p-4 mb-4">
                    <h3 className="font-medium text-[#101E57] mb-3">Quick Setup Guide</h3>
                    <ol className="text-sm text-[#667085] space-y-3">
                      <li className="flex gap-3">
                        <span className="flex-shrink-0 w-6 h-6 bg-[#4A154B] text-white rounded-full flex items-center justify-center text-xs font-medium">1</span>
                        <span>Go to your <a href="https://api.slack.com/apps" target="_blank" rel="noopener noreferrer" className="text-[#6F71EE] hover:underline">Slack Apps</a> and create a new app (or use an existing one)</span>
                      </li>
                      <li className="flex gap-3">
                        <span className="flex-shrink-0 w-6 h-6 bg-[#4A154B] text-white rounded-full flex items-center justify-center text-xs font-medium">2</span>
                        <span>Enable &quot;Incoming Webhooks&quot; in your app settings</span>
                      </li>
                      <li className="flex gap-3">
                        <span className="flex-shrink-0 w-6 h-6 bg-[#4A154B] text-white rounded-full flex items-center justify-center text-xs font-medium">3</span>
                        <span>Click &quot;Add New Webhook to Workspace&quot; and select your channel</span>
                      </li>
                      <li className="flex gap-3">
                        <span className="flex-shrink-0 w-6 h-6 bg-[#4A154B] text-white rounded-full flex items-center justify-center text-xs font-medium">4</span>
                        <span>Copy the webhook URL and paste it below</span>
                      </li>
                    </ol>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-[#101E57] mb-1">
                        Webhook URL
                      </label>
                      <input
                        type="url"
                        value={slackWebhook}
                        onChange={(e) => setSlackWebhook(e.target.value)}
                        placeholder="https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXX"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57] font-mono text-sm"
                      />
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        onClick={saveSlackConfig}
                        disabled={!slackWebhook || savingSlack}
                        className="bg-[#4A154B] text-white px-4 py-2 rounded-lg hover:bg-[#3c1040] transition disabled:opacity-50 font-medium text-sm"
                      >
                        {savingSlack ? 'Connecting...' : 'Connect Slack'}
                      </button>
                      <button
                        onClick={() => setShowSlackSetup(false)}
                        className="text-[#667085] hover:text-[#101E57] text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {slackStatus?.connected && (
                <div className="mt-4">
                  {/* Connected state with benefits and actions */}
                  <div className="bg-gradient-to-r from-[#f3f0f4] to-[#f9f7fa] border border-[#d9c8e0] rounded-lg p-4 mb-4">
                    <h3 className="font-medium text-[#101E57] mb-3">Notifications active:</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-[#4A154B]">&#10003;</span>
                        <span className="text-[#667085]">New bookings</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[#4A154B]">&#10003;</span>
                        <span className="text-[#667085]">Daily digest (7am)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[#4A154B]">&#10003;</span>
                        <span className="text-[#667085]">Session summaries</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={testSlackConnection}
                      disabled={testingSlack}
                      className="bg-[#4A154B] text-white px-4 py-2 rounded-lg hover:bg-[#3c1040] transition disabled:opacity-50 font-medium text-sm"
                    >
                      {testingSlack ? 'Sending...' : 'Send Test Message'}
                    </button>
                    <button
                      onClick={() => setShowSlackSetup(true)}
                      className="text-[#667085] hover:text-[#101E57] text-sm"
                    >
                      Update webhook
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* SMS Integration */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-[#00D67A] rounded-lg flex items-center justify-center text-white font-bold text-lg">
              SMS
            </div>
            <div className="flex-1">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-[#101E57]">SMS Reminders</h2>
                  <p className="text-sm text-[#667085] mt-1">
                    Send text message reminders to reduce no-shows
                  </p>
                </div>
                {smsStatus?.connected && (
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1 text-sm text-green-600">
                      <span className="w-2 h-2 bg-green-500 rounded-full" />
                      Connected ({smsStatus.provider})
                    </span>
                    <button
                      onClick={disconnectSms}
                      className="text-red-600 hover:text-red-700 text-sm font-medium ml-4"
                    >
                      Disconnect
                    </button>
                  </div>
                )}
              </div>

              {!smsStatus?.connected && !showSmsSetup && (
                <div className="mt-4">
                  <div className="bg-gradient-to-r from-[#e6fff5] to-[#f0fff9] border border-[#99ffd6] rounded-lg p-4 mb-4">
                    <p className="text-sm font-medium text-[#101E57] mb-2">Reduce no-shows by up to 30%:</p>
                    <ul className="text-sm text-[#667085] space-y-2">
                      <li className="flex items-start gap-2">
                        <span className="text-[#00D67A] mt-0.5">&#10003;</span>
                        <span>SMS has 98% open rate vs 20% for email</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-[#00D67A] mt-0.5">&#10003;</span>
                        <span>Attendees get reminders directly on their phone</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-[#00D67A] mt-0.5">&#10003;</span>
                        <span>Supports international phone numbers</span>
                      </li>
                    </ul>
                  </div>

                  <button
                    onClick={() => setShowSmsSetup(true)}
                    className="bg-[#00D67A] text-white px-4 py-2 rounded-lg hover:bg-[#00c06d] transition font-medium text-sm"
                  >
                    Set Up SMS
                  </button>
                </div>
              )}

              {!smsStatus?.connected && showSmsSetup && (
                <div className="mt-4 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-[#101E57] mb-1">
                      Provider
                    </label>
                    <select
                      value={smsProvider}
                      onChange={(e) => setSmsProvider(e.target.value as 'aircall' | 'twilio')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57]"
                    >
                      <option value="aircall">Aircall</option>
                      <option value="twilio">Twilio</option>
                    </select>
                  </div>

                  {/* Setup Guide */}
                  <div className="bg-[#F6F6F9] rounded-lg p-4">
                    <h4 className="text-sm font-semibold text-[#101E57] mb-3">
                      {smsProvider === 'twilio' ? 'Twilio' : 'Aircall'} Setup Guide
                    </h4>
                    {smsProvider === 'twilio' ? (
                      <ol className="space-y-3">
                        <li className="flex items-start gap-3">
                          <span className="flex-shrink-0 w-6 h-6 bg-[#6F71EE] text-white rounded-full flex items-center justify-center text-xs font-medium">1</span>
                          <div className="text-sm text-[#667085]">
                            <a href="https://www.twilio.com/try-twilio" target="_blank" rel="noopener noreferrer" className="text-[#6F71EE] hover:underline font-medium">Create a Twilio account</a> if you don&apos;t have one
                          </div>
                        </li>
                        <li className="flex items-start gap-3">
                          <span className="flex-shrink-0 w-6 h-6 bg-[#6F71EE] text-white rounded-full flex items-center justify-center text-xs font-medium">2</span>
                          <div className="text-sm text-[#667085]">
                            Go to <strong className="text-[#101E57]">Console → Account → API Keys &amp; Tokens</strong>
                          </div>
                        </li>
                        <li className="flex items-start gap-3">
                          <span className="flex-shrink-0 w-6 h-6 bg-[#6F71EE] text-white rounded-full flex items-center justify-center text-xs font-medium">3</span>
                          <div className="text-sm text-[#667085]">
                            Copy your <strong className="text-[#101E57]">Account SID</strong> and <strong className="text-[#101E57]">Auth Token</strong>
                          </div>
                        </li>
                        <li className="flex items-start gap-3">
                          <span className="flex-shrink-0 w-6 h-6 bg-[#6F71EE] text-white rounded-full flex items-center justify-center text-xs font-medium">4</span>
                          <div className="text-sm text-[#667085]">
                            Go to <strong className="text-[#101E57]">Phone Numbers → Manage → Buy a number</strong> and purchase an SMS-capable number
                          </div>
                        </li>
                        <li className="flex items-start gap-3">
                          <span className="flex-shrink-0 w-6 h-6 bg-[#6F71EE] text-white rounded-full flex items-center justify-center text-xs font-medium">5</span>
                          <div className="text-sm text-[#667085]">
                            Enter the credentials below to connect
                          </div>
                        </li>
                      </ol>
                    ) : (
                      <ol className="space-y-3">
                        <li className="flex items-start gap-3">
                          <span className="flex-shrink-0 w-6 h-6 bg-[#6F71EE] text-white rounded-full flex items-center justify-center text-xs font-medium">1</span>
                          <div className="text-sm text-[#667085]">
                            <a href="https://www.aircall.io" target="_blank" rel="noopener noreferrer" className="text-[#6F71EE] hover:underline font-medium">Log in to Aircall</a> or create an account
                          </div>
                        </li>
                        <li className="flex items-start gap-3">
                          <span className="flex-shrink-0 w-6 h-6 bg-[#6F71EE] text-white rounded-full flex items-center justify-center text-xs font-medium">2</span>
                          <div className="text-sm text-[#667085]">
                            Go to <strong className="text-[#101E57]">Integrations → Public API</strong>
                          </div>
                        </li>
                        <li className="flex items-start gap-3">
                          <span className="flex-shrink-0 w-6 h-6 bg-[#6F71EE] text-white rounded-full flex items-center justify-center text-xs font-medium">3</span>
                          <div className="text-sm text-[#667085]">
                            Generate a new <strong className="text-[#101E57]">API Key</strong> with SMS permissions
                          </div>
                        </li>
                        <li className="flex items-start gap-3">
                          <span className="flex-shrink-0 w-6 h-6 bg-[#6F71EE] text-white rounded-full flex items-center justify-center text-xs font-medium">4</span>
                          <div className="text-sm text-[#667085]">
                            Ensure you have an SMS-capable phone number in your Aircall account
                          </div>
                        </li>
                        <li className="flex items-start gap-3">
                          <span className="flex-shrink-0 w-6 h-6 bg-[#6F71EE] text-white rounded-full flex items-center justify-center text-xs font-medium">5</span>
                          <div className="text-sm text-[#667085]">
                            Enter the API key and phone number below to connect
                          </div>
                        </li>
                      </ol>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[#101E57] mb-1">
                      {smsProvider === 'twilio' ? 'Account SID' : 'API Key'}
                    </label>
                    <input
                      type="password"
                      value={smsApiKey}
                      onChange={(e) => setSmsApiKey(e.target.value)}
                      placeholder={smsProvider === 'twilio' ? 'ACxxxxxxxxxx' : 'Enter your API key'}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57]"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[#101E57] mb-1">
                      {smsProvider === 'twilio' ? 'Auth Token' : 'API Secret'} (optional)
                    </label>
                    <input
                      type="password"
                      value={smsApiSecret}
                      onChange={(e) => setSmsApiSecret(e.target.value)}
                      placeholder="Enter secret if required"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57]"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[#101E57] mb-1">
                      Sender Phone Number
                    </label>
                    <input
                      type="tel"
                      value={smsSenderPhone}
                      onChange={(e) => setSmsSenderPhone(e.target.value)}
                      placeholder="+15551234567"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57]"
                    />
                    <p className="text-xs text-[#667085] mt-1">
                      The phone number that will send SMS reminders (E.164 format)
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={saveSmsConfig}
                      disabled={!smsApiKey.trim() || savingSms}
                      className="bg-[#00D67A] text-white px-4 py-2 rounded-lg hover:bg-[#00c06d] transition disabled:opacity-50 font-medium text-sm"
                    >
                      {savingSms ? 'Connecting...' : 'Connect SMS'}
                    </button>
                    <button
                      onClick={() => setShowSmsSetup(false)}
                      className="text-[#667085] hover:text-[#101E57] text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {smsStatus?.connected && (
                <div className="mt-4">
                  <div className="bg-gradient-to-r from-[#e6fff5] to-[#f0fff9] border border-[#99ffd6] rounded-lg p-4 mb-4">
                    <h3 className="font-medium text-[#101E57] mb-3">SMS Features:</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-[#00D67A]">&#10003;</span>
                        <span className="text-[#667085]">24-hour reminders</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[#00D67A]">&#10003;</span>
                        <span className="text-[#667085]">1-hour reminders</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[#00D67A]">&#10003;</span>
                        <span className="text-[#667085]">Opt-in consent</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[#00D67A]">&#10003;</span>
                        <span className="text-[#667085]">International support</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <input
                      type="tel"
                      value={testSmsPhone}
                      onChange={(e) => setTestSmsPhone(e.target.value)}
                      placeholder="+1 555 123 4567"
                      className="w-48 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57] text-sm"
                    />
                    <button
                      onClick={testSmsConnection}
                      disabled={testingSms || !testSmsPhone.trim()}
                      className="bg-[#00D67A] text-white px-4 py-2 rounded-lg hover:bg-[#00c06d] transition disabled:opacity-50 font-medium text-sm"
                    >
                      {testingSms ? 'Sending...' : 'Send Test SMS'}
                    </button>
                  </div>
                  <p className="text-xs text-[#667085] mt-2">
                    Enable SMS reminders for individual events in Event Settings.
                  </p>

                  <div className="flex items-center gap-4 mt-4 pt-4 border-t border-gray-200">
                    <Link
                      href="/admin/sms"
                      className="text-sm text-[#6F71EE] hover:underline font-medium"
                    >
                      View SMS Dashboard →
                    </Link>
                    <Link
                      href="/admin/sms/logs"
                      className="text-sm text-[#667085] hover:text-[#101E57]"
                    >
                      View All Logs
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Google Calendar (already connected via login) */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-white border border-gray-200 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-[#101E57]">Google Calendar</h2>
              <p className="text-sm text-[#667085] mt-1">
                Calendar integration for scheduling and availability
              </p>
              <div className="mt-2 flex items-center gap-1 text-sm text-green-600">
                <span className="w-2 h-2 bg-green-500 rounded-full" />
                Connected via Google Sign-In
              </div>
              <p className="text-xs text-[#667085] mt-2">
                Manage availability settings in the{' '}
                <a href="/admin/settings" className="text-[#6F71EE] hover:underline">
                  Availability page
                </a>
              </p>
            </div>
          </div>
        </div>
    </PageContainer>
  );
}

export default function IntegrationsPage() {
  return (
    <Suspense
      fallback={
        <PageContainer narrow>
          <PageHeader
            title="Integrations"
            description="Connect external services to enhance your scheduling"
          />
          <div className="bg-white rounded-xl p-6 animate-pulse">
            <div className="h-6 bg-gray-200 rounded w-48 mb-4" />
            <div className="h-32 bg-gray-100 rounded" />
          </div>
        </PageContainer>
      }
    >
      <IntegrationsContent />
    </Suspense>
  );
}

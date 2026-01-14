'use client';

import { useState, useEffect, Suspense } from 'react';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import AdminNav from '@/components/AdminNav';

interface HubSpotStatus {
  connected: boolean;
  portalId?: string;
  connectedAt?: string;
}

interface SlackStatus {
  connected: boolean;
  webhookConfigured?: boolean;
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
      const [hubspotRes, slackRes] = await Promise.all([
        fetch('/api/hubspot/auth', { method: 'POST' }),
        fetch('/api/slack/status'),
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

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F6F6F9] flex items-center justify-center">
        <p className="text-[#667085]">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F6F6F9]">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-4">
              <Image
                src="https://info.whyliveschool.com/hubfs/Brand/liveschool-logo.png"
                alt="LiveSchool"
                width={140}
                height={36}
              />
              <span className="text-[#667085] text-sm font-medium">Connect</span>
            </div>
            <a
              href="/api/auth/logout"
              className="text-red-600 hover:text-red-700 text-sm font-medium"
            >
              Sign out
            </a>
          </div>
          <AdminNav />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-[#101E57]">Integrations</h1>
          <p className="text-[#667085] mt-1">
            Connect external services to enhance your scheduling
          </p>
        </div>

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
                <a href="/admin/availability" className="text-[#6F71EE] hover:underline">
                  Availability page
                </a>
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function IntegrationsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#F6F6F9] flex items-center justify-center">
          <p className="text-[#667085]">Loading...</p>
        </div>
      }
    >
      <IntegrationsContent />
    </Suspense>
  );
}

'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import type { OHEvent } from '@/types';
import { defaultTemplates } from '@/lib/email-templates';
import Breadcrumb from '@/components/Breadcrumb';
import {
  generateConfirmationEmailHtml,
  generateReminderEmailHtml,
  generateFollowupEmailHtml,
  generateCancellationEmailHtml,
} from '@/lib/email-html';

type TemplateType = 'confirmation' | 'reminder' | 'cancellation' | 'no_show';

export default function EmailTemplatesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [event, setEvent] = useState<OHEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [activeTab, setActiveTab] = useState<TemplateType>('confirmation');
  const [showVariables, setShowVariables] = useState(false);

  // Sample data for preview
  const sampleData = {
    first_name: 'Sarah',
    last_name: 'Johnson',
    email: 'sarah.johnson@example.com',
    event_name: event?.name || 'Your Session',
    host_name: event?.host_name || 'The Team',
    date: 'Tuesday, January 21, 2025',
    time: '2:00 PM EST',
    meet_link: 'https://meet.google.com/abc-defg-hij',
    reminder_timing: 'tomorrow',
    rebook_link: `https://connect.liveschool.com/book/${event?.slug || 'your-event'}`,
  };

  const [templates, setTemplates] = useState({
    confirmation_subject: '',
    confirmation_body: '',
    reminder_subject: '',
    reminder_body: '',
    cancellation_subject: '',
    cancellation_body: '',
    no_show_subject: '',
    no_show_body: '',
  });

  useEffect(() => {
    fetchEvent();
  }, [id]);

  const fetchEvent = async () => {
    try {
      const response = await fetch(`/api/events/${id}`);
      if (!response.ok) throw new Error('Event not found');

      const data = await response.json();
      setEvent(data);

      // Set templates from event data or use defaults
      setTemplates({
        confirmation_subject: data.confirmation_subject || defaultTemplates.confirmation_subject,
        confirmation_body: data.confirmation_body || defaultTemplates.confirmation_body,
        reminder_subject: data.reminder_subject || defaultTemplates.reminder_subject,
        reminder_body: data.reminder_body || defaultTemplates.reminder_body,
        cancellation_subject: data.cancellation_subject || defaultTemplates.cancellation_subject,
        cancellation_body: data.cancellation_body || defaultTemplates.cancellation_body,
        no_show_subject: data.no_show_subject || defaultTemplates.no_show_subject,
        no_show_body: data.no_show_body || defaultTemplates.no_show_body,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load event');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`/api/events/${id}/templates`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(templates),
      });

      if (!response.ok) throw new Error('Failed to save templates');

      setSuccess('Email templates saved successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save templates');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = (type: TemplateType) => {
    setTemplates((prev) => ({
      ...prev,
      [`${type}_subject`]: defaultTemplates[`${type}_subject`],
      [`${type}_body`]: defaultTemplates[`${type}_body`],
    }));
  };

  const templateInfo = {
    confirmation: {
      title: 'Confirmation',
      description: 'Sent immediately after someone books a slot.',
    },
    reminder: {
      title: 'Reminder',
      description: 'Sent 24 hours and 1 hour before the session.',
    },
    cancellation: {
      title: 'Cancellation',
      description: 'Sent when a session is cancelled.',
    },
    no_show: {
      title: 'No-Show',
      description: 'Sent automatically to attendees marked as no-show, with a link to rebook.',
    },
  };

  const availableVariables = [
    { var: '{{first_name}}', desc: "Attendee's first name", sample: sampleData.first_name },
    { var: '{{last_name}}', desc: "Attendee's last name", sample: sampleData.last_name },
    { var: '{{email}}', desc: "Attendee's email", sample: sampleData.email },
    { var: '{{event_name}}', desc: 'Name of the event', sample: sampleData.event_name },
    { var: '{{host_name}}', desc: "Host's name", sample: sampleData.host_name },
    { var: '{{date}}', desc: 'Session date', sample: sampleData.date },
    { var: '{{time}}', desc: 'Session time', sample: sampleData.time },
    { var: '{{meet_link}}', desc: 'Google Meet link', sample: sampleData.meet_link },
    { var: '{{reminder_timing}}', desc: 'e.g., "tomorrow" or "in 1 hour"', sample: sampleData.reminder_timing },
    { var: '{{rebook_link}}', desc: 'Link to book another session (for no-show emails)', sample: sampleData.rebook_link },
  ];

  // Replace template variables with sample data for preview
  const getPreviewContent = (template: string) => {
    let result = template;
    availableVariables.forEach((v) => {
      result = result.replace(new RegExp(v.var.replace(/[{}]/g, '\\$&'), 'g'), v.sample);
    });
    return result;
  };

  // Generate styled HTML preview for the active template type
  const getStyledPreviewHtml = (): string => {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://liveschoolhelp.com';

    switch (activeTab) {
      case 'confirmation':
        return generateConfirmationEmailHtml({
          firstName: sampleData.first_name,
          eventName: sampleData.event_name,
          hostName: sampleData.host_name,
          date: sampleData.date,
          time: '2:00 PM',
          timezoneAbbr: 'CT',
          timezone: 'Central Time',
          meetLink: sampleData.meet_link,
          manageUrl: `${appUrl}/manage/sample-token`,
          googleCalUrl: 'https://calendar.google.com/calendar/render?action=TEMPLATE',
          outlookUrl: 'https://outlook.live.com/calendar/0/deeplink/compose',
          icalUrl: `${appUrl}/api/ical/sample`,
          customBodyHtml: templates.confirmation_body
            ? `<div style="white-space: pre-wrap;">${getPreviewContent(templates.confirmation_body)}</div>`
            : undefined,
        });

      case 'reminder':
        return generateReminderEmailHtml({
          firstName: sampleData.first_name,
          eventName: sampleData.event_name,
          hostName: sampleData.host_name,
          date: sampleData.date,
          time: '2:00 PM',
          timezoneAbbr: 'CT',
          meetLink: sampleData.meet_link,
          manageUrl: `${appUrl}/manage/sample-token`,
          reminderTiming: sampleData.reminder_timing,
        });

      case 'no_show':
        return generateFollowupEmailHtml({
          recipientFirstName: sampleData.first_name,
          eventName: sampleData.event_name,
          hostName: sampleData.host_name,
          sessionDate: 'Tuesday, January 21',
          sessionTime: '2:00 PM',
          timezoneAbbr: 'CT',
          bookingPageUrl: sampleData.rebook_link,
          isNoShow: true,
          customMessage: templates.no_show_body
            ? getPreviewContent(templates.no_show_body)
            : undefined,
        });

      case 'cancellation':
        return generateCancellationEmailHtml({
          recipientFirstName: sampleData.first_name,
          eventName: sampleData.event_name,
          hostName: sampleData.host_name,
          sessionDate: 'Tuesday, January 21',
          sessionTime: '2:00 PM',
          timezoneAbbr: 'CT',
          bookingPageUrl: sampleData.rebook_link,
          customMessage: templates.cancellation_body
            ? getPreviewContent(templates.cancellation_body)
            : undefined,
        });

      default:
        return '';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F6F6F9] flex items-center justify-center">
        <p className="text-[#667085]">Loading...</p>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-[#F6F6F9] flex items-center justify-center">
        <p className="text-[#667085]">Event not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F6F6F9]">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-4">
          <Image
            src="https://info.whyliveschool.com/hubfs/Brand/liveschool-logo.png"
            alt="LiveSchool"
            width={120}
            height={32}
          />
          <Breadcrumb
            items={[
              { label: 'Dashboard', href: '/admin' },
              { label: event.name, href: `/admin/events/${id}` },
              { label: 'Email Templates' },
            ]}
          />
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {error && (
          <div className="bg-red-50 text-red-700 p-4 rounded mb-6 text-sm">{error}</div>
        )}

        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-[#101E57]">Email Templates</h1>
          <p className="text-[#667085] mt-1">Customize the emails sent to attendees</p>
          <div className="mt-3 flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg p-3">
            <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-blue-800">
              These templates apply to <strong>all bookings</strong> for this event. Changes you make here will affect emails sent to everyone who books &ldquo;{event.name}&rdquo;.
            </p>
          </div>
        </div>

        {/* Template Tabs */}
        <div className="bg-white rounded-t-lg shadow-sm border border-gray-200 border-b-0">
          <div className="flex">
            {(['confirmation', 'reminder', 'cancellation', 'no_show'] as TemplateType[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 px-4 py-3 text-sm font-medium transition ${
                  activeTab === tab
                    ? 'text-[#6F71EE] border-b-2 border-[#6F71EE] bg-white'
                    : 'text-[#667085] hover:text-[#101E57] bg-gray-50'
                }`}
              >
                {templateInfo[tab].title}
              </button>
            ))}
          </div>
        </div>

        {/* Main Content - Side by Side */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-0">
          {/* Left: Editor */}
          <div className="bg-white border border-gray-200 border-r-0 xl:rounded-bl-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-[#101E57]">Edit Template</h3>
                <p className="text-sm text-[#667085]">{templateInfo[activeTab].description}</p>
              </div>
              <button
                onClick={() => setShowVariables(!showVariables)}
                className="text-sm text-[#6F71EE] hover:text-[#5a5cd0] flex items-center gap-1"
              >
                <span>{showVariables ? 'Hide' : 'Show'} Variables</span>
                <svg className={`w-4 h-4 transition-transform ${showVariables ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>

            {/* Collapsible Variables */}
            {showVariables && (
              <div className="mb-4 p-3 bg-[#F6F6F9] rounded-lg">
                <p className="text-xs text-[#667085] mb-2">Click to copy a variable:</p>
                <div className="flex flex-wrap gap-2">
                  {availableVariables.slice(0, 6).map((v) => (
                    <button
                      key={v.var}
                      onClick={() => navigator.clipboard.writeText(v.var)}
                      className="px-2 py-1 bg-white border border-gray-200 rounded text-xs font-mono text-[#6F71EE] hover:bg-[#6F71EE] hover:text-white transition"
                      title={v.desc}
                    >
                      {v.var}
                    </button>
                  ))}
                  <button
                    onClick={() => setShowVariables(true)}
                    className="px-2 py-1 text-xs text-[#667085] hover:text-[#101E57]"
                  >
                    +{availableVariables.length - 6} more
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#101E57] mb-1">
                  Subject Line
                </label>
                <input
                  type="text"
                  value={templates[`${activeTab}_subject`]}
                  onChange={(e) =>
                    setTemplates((prev) => ({
                      ...prev,
                      [`${activeTab}_subject`]: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#101E57] mb-1">
                  {activeTab === 'no_show' ? 'Custom Message' : 'Email Body'}
                </label>
                <textarea
                  value={templates[`${activeTab}_body`]}
                  onChange={(e) =>
                    setTemplates((prev) => ({
                      ...prev,
                      [`${activeTab}_body`]: e.target.value,
                    }))
                  }
                  rows={14}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57] font-mono text-sm"
                  placeholder="Write your message here..."
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-[#6F71EE] text-white px-5 py-2.5 rounded-lg hover:bg-[#5a5cd0] transition disabled:opacity-50 font-medium"
                >
                  {saving ? 'Saving...' : 'Save Templates'}
                </button>
                <button
                  onClick={() => handleReset(activeTab)}
                  className="px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition text-[#667085] font-medium"
                >
                  Reset
                </button>
                {success && (
                  <span className="text-sm text-green-600 flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Saved!
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right: Live Preview */}
          <div className="bg-[#F6F6F9] border border-gray-200 xl:rounded-br-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-[#101E57] flex items-center gap-2">
                  Live Preview
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-normal">
                    Updates as you type
                  </span>
                </h3>
                <p className="text-sm text-[#667085]">
                  Showing preview for: {sampleData.first_name} {sampleData.last_name}
                </p>
              </div>
            </div>

            {/* Subject Preview */}
            <div className="mb-3">
              <div className="bg-white border border-gray-200 rounded-t-lg px-4 py-3">
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-[#667085]">Subject:</span>
                  <span className="text-[#101E57] font-medium">
                    {getPreviewContent(templates[`${activeTab}_subject`])}
                  </span>
                </div>
              </div>
            </div>

            {/* Email Preview in iframe */}
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
              <iframe
                srcDoc={getStyledPreviewHtml()}
                className="w-full h-[500px]"
                title="Email Preview"
                sandbox="allow-same-origin"
              />
            </div>

            <p className="text-xs text-[#667085] mt-3 text-center">
              This is exactly how the email will appear in your recipients&apos; inbox
            </p>
          </div>
        </div>

        {/* Full Variables Reference (expandable) */}
        {showVariables && (
          <div className="mt-6 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="font-semibold text-[#101E57] mb-4">All Available Variables</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {availableVariables.map((v) => (
                <button
                  key={v.var}
                  onClick={() => navigator.clipboard.writeText(v.var)}
                  className="text-left p-3 rounded-lg border border-gray-200 hover:border-[#6F71EE] hover:bg-[#F6F6F9] transition group"
                >
                  <code className="text-[#6F71EE] font-mono text-sm block mb-1">{v.var}</code>
                  <p className="text-xs text-[#667085]">{v.desc}</p>
                </button>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

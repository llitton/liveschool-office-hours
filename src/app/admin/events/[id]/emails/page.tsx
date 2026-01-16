'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import type { OHEvent } from '@/types';
import { defaultTemplates } from '@/lib/email-templates';
import Breadcrumb from '@/components/Breadcrumb';

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
  const [showPreview, setShowPreview] = useState(false);
  const [showVariables, setShowVariables] = useState(true);

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

        {success && (
          <div className="bg-green-50 text-green-700 p-4 rounded mb-6 text-sm">{success}</div>
        )}

        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-[#101E57]">Email Templates</h1>
          <p className="text-[#667085] mt-1">Customize the emails sent to attendees</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Editor */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              {/* Tabs */}
              <div className="flex border-b border-gray-200">
                {(['confirmation', 'reminder', 'cancellation', 'no_show'] as TemplateType[]).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`flex-1 px-4 py-3 text-sm font-medium transition ${
                      activeTab === tab
                        ? 'text-[#6F71EE] border-b-2 border-[#6F71EE] -mb-px'
                        : 'text-[#667085] hover:text-[#101E57]'
                    }`}
                  >
                    {templateInfo[tab].title}
                  </button>
                ))}
              </div>

              <div className="p-6">
                <p className="text-sm text-[#667085] mb-4">
                  {templateInfo[activeTab].description}
                </p>

                {/* Preview Toggle */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => setShowPreview(false)}
                      className={`px-3 py-1.5 text-sm font-medium rounded-lg transition ${
                        !showPreview
                          ? 'bg-[#6F71EE] text-white'
                          : 'bg-gray-100 text-[#667085] hover:bg-gray-200'
                      }`}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setShowPreview(true)}
                      className={`px-3 py-1.5 text-sm font-medium rounded-lg transition ${
                        showPreview
                          ? 'bg-[#6F71EE] text-white'
                          : 'bg-gray-100 text-[#667085] hover:bg-gray-200'
                      }`}
                    >
                      Preview
                    </button>
                  </div>
                  {showPreview && (
                    <span className="text-xs text-[#667085] bg-[#F6F6F9] px-2 py-1 rounded">
                      Showing sample attendee: {sampleData.first_name} {sampleData.last_name}
                    </span>
                  )}
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-[#101E57] mb-1">
                      Subject Line
                    </label>
                    {showPreview ? (
                      <div className="w-full px-3 py-2 bg-[#F6F6F9] border border-gray-200 rounded-lg text-[#101E57]">
                        {getPreviewContent(templates[`${activeTab}_subject`])}
                      </div>
                    ) : (
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
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[#101E57] mb-1">
                      Email Body
                    </label>
                    {showPreview ? (
                      <div className="w-full px-3 py-2 bg-[#F6F6F9] border border-gray-200 rounded-lg text-[#101E57] whitespace-pre-wrap min-h-[200px]">
                        {getPreviewContent(templates[`${activeTab}_body`])}
                      </div>
                    ) : (
                      <textarea
                        value={templates[`${activeTab}_body`]}
                        onChange={(e) =>
                          setTemplates((prev) => ({
                            ...prev,
                            [`${activeTab}_body`]: e.target.value,
                          }))
                        }
                        rows={12}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57] font-mono text-sm"
                      />
                    )}
                  </div>
                </div>

                <div className="flex gap-4 mt-6">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="bg-[#6F71EE] text-white px-4 py-2 rounded-lg hover:bg-[#5a5cd0] transition disabled:opacity-50 font-medium"
                  >
                    {saving ? 'Saving...' : 'Save All Templates'}
                  </button>
                  <button
                    onClick={() => handleReset(activeTab)}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition text-[#667085] font-medium"
                  >
                    Reset to Default
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Variables Reference */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 sticky top-8 overflow-hidden">
              <button
                onClick={() => setShowVariables(!showVariables)}
                className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-gray-50 transition"
              >
                <h3 className="font-semibold text-[#101E57]">Available Variables</h3>
                <svg
                  className={`w-5 h-5 text-[#667085] transition-transform ${showVariables ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showVariables && (
                <div className="px-6 pb-6">
                  <p className="text-sm text-[#667085] mb-4">
                    Click to copy. Variables are replaced with actual values when emails are sent.
                  </p>
                  <div className="space-y-2">
                    {availableVariables.map((v) => (
                      <button
                        key={v.var}
                        onClick={() => {
                          navigator.clipboard.writeText(v.var);
                        }}
                        className="w-full text-left p-2 rounded-lg hover:bg-[#F6F6F9] transition group"
                      >
                        <div className="flex items-center justify-between">
                          <code className="bg-[#F6F6F9] group-hover:bg-white px-2 py-0.5 rounded text-[#6F71EE] font-mono text-sm">
                            {v.var}
                          </code>
                          <span className="text-xs text-[#667085] opacity-0 group-hover:opacity-100 transition">
                            Click to copy
                          </span>
                        </div>
                        <p className="text-xs text-[#667085] mt-1">{v.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { PageContainer, PageHeader } from '@/components/AppShell';
import Link from 'next/link';
import type { OHSessionTemplate } from '@/types';

const MEETING_TYPE_LABELS: Record<string, string> = {
  one_on_one: '1:1 Meeting',
  group: 'Group Session',
  collective: 'Collective (All Hosts)',
  round_robin: 'Round Robin',
  panel: 'Panel',
  webinar: 'Webinar',
};

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<OHSessionTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const response = await fetch('/api/session-templates');
      if (response.ok) {
        const data = await response.json();
        setTemplates(data);
      }
    } catch (error) {
      console.error('Failed to fetch templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;

    setDeleting(id);
    try {
      const response = await fetch(`/api/session-templates/${id}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        setTemplates((prev) => prev.filter((t) => t.id !== id));
      }
    } catch (error) {
      console.error('Failed to delete template:', error);
    } finally {
      setDeleting(null);
    }
  };

  const systemTemplates = templates.filter((t) => t.is_system);
  const userTemplates = templates.filter((t) => !t.is_system);

  return (
    <PageContainer>
      <PageHeader
        title="Event Templates"
        description="Templates capture complete event configurations including email templates, SMS, booking rules, and more."
        action={
          <Link
            href="/admin/events/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#6F71EE] text-white rounded-lg hover:bg-[#5B5DD6] transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Event
          </Link>
        }
      />

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-[#E0E0E0] p-6 animate-pulse">
              <div className="h-5 bg-gray-200 rounded w-48 mb-2" />
              <div className="h-4 bg-gray-200 rounded w-32" />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-8">
          {/* User Templates */}
          <section>
            <h2 className="text-lg font-semibold text-[#101E57] mb-4">Your Templates</h2>
            {userTemplates.length === 0 ? (
              <div className="bg-white rounded-xl border border-[#E0E0E0] p-8 text-center">
                <div className="w-12 h-12 bg-[#F6F6F9] rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-[#667085]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="font-medium text-[#101E57] mb-2">No custom templates yet</h3>
                <p className="text-sm text-[#667085] mb-4">
                  Create a template by saving an existing event's configuration.
                </p>
                <p className="text-xs text-[#667085]">
                  Go to any event → Click "Save as Template"
                </p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {userTemplates.map((template) => (
                  <div
                    key={template.id}
                    className="bg-white rounded-xl border border-[#E0E0E0] p-5 hover:border-[#6F71EE] transition"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{template.icon}</span>
                        <div>
                          <h3 className="font-medium text-[#101E57]">{template.name}</h3>
                          <p className="text-xs text-[#667085]">
                            {MEETING_TYPE_LABELS[template.meeting_type] || template.meeting_type}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDelete(template.id)}
                        disabled={deleting === template.id}
                        className="p-1.5 text-[#667085] hover:text-red-500 hover:bg-red-50 rounded transition disabled:opacity-50"
                        title="Delete template"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>

                    {template.description && (
                      <p className="text-sm text-[#667085] mb-3 line-clamp-2">{template.description}</p>
                    )}

                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="px-2 py-1 bg-[#F6F6F9] text-[#667085] rounded">
                        {template.duration_minutes} min
                      </span>
                      <span className="px-2 py-1 bg-[#F6F6F9] text-[#667085] rounded">
                        Max {template.max_attendees}
                      </span>
                      {template.require_approval && (
                        <span className="px-2 py-1 bg-amber-50 text-amber-700 rounded">
                          Approval required
                        </span>
                      )}
                      {template.waitlist_enabled && (
                        <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded">
                          Waitlist
                        </span>
                      )}
                      {template.sms_reminders_enabled && (
                        <span className="px-2 py-1 bg-green-50 text-green-700 rounded">
                          SMS
                        </span>
                      )}
                      {template.no_show_emails_enabled && (
                        <span className="px-2 py-1 bg-purple-50 text-purple-700 rounded">
                          No-show emails
                        </span>
                      )}
                      {template.ignore_busy_blocks && (
                        <span className="px-2 py-1 bg-orange-50 text-orange-700 rounded">
                          Any time
                        </span>
                      )}
                    </div>

                    <div className="mt-4 pt-3 border-t border-[#E0E0E0]">
                      <Link
                        href={`/admin/events/new?template=${template.id}`}
                        className="text-sm text-[#6F71EE] hover:underline font-medium"
                      >
                        Use this template →
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* System Templates */}
          <section>
            <h2 className="text-lg font-semibold text-[#101E57] mb-4">System Templates</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {systemTemplates.map((template) => (
                <div
                  key={template.id}
                  className="bg-white rounded-xl border border-[#E0E0E0] p-5 hover:border-[#6F71EE] transition"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-2xl">{template.icon}</span>
                    <div>
                      <h3 className="font-medium text-[#101E57]">{template.name}</h3>
                      <p className="text-xs text-[#667085]">
                        {MEETING_TYPE_LABELS[template.meeting_type] || template.meeting_type}
                      </p>
                    </div>
                  </div>

                  {template.description && (
                    <p className="text-sm text-[#667085] mb-3 line-clamp-2">{template.description}</p>
                  )}

                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="px-2 py-1 bg-[#F6F6F9] text-[#667085] rounded">
                      {template.duration_minutes} min
                    </span>
                    <span className="px-2 py-1 bg-[#F6F6F9] text-[#667085] rounded">
                      Max {template.max_attendees}
                    </span>
                  </div>

                  <div className="mt-4 pt-3 border-t border-[#E0E0E0]">
                    <Link
                      href={`/admin/events/new?template=${template.id}`}
                      className="text-sm text-[#6F71EE] hover:underline font-medium"
                    >
                      Use this template →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </PageContainer>
  );
}

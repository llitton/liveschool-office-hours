'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { PageContainer, PageHeader } from '@/components/AppShell';
import { LinkButton } from '@/components/ui/Button';
import type { RoutingQuestion } from '@/types';

interface RoutingFormWithEvent {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  questions: RoutingQuestion[];
  default_event_id: string | null;
  is_active: boolean;
  submission_count: number;
  created_at: string;
  updated_at: string;
  default_event: { id: string; name: string; slug: string } | null;
}

export default function PeopleRoutingPage() {
  const [forms, setForms] = useState<RoutingFormWithEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchForms();
  }, []);

  const fetchForms = async () => {
    try {
      const response = await fetch('/api/routing-forms');
      if (!response.ok) throw new Error('Failed to load routing forms');
      const data = await response.json();
      setForms(data.forms);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load forms');
    } finally {
      setLoading(false);
    }
  };

  const toggleActive = async (form: RoutingFormWithEvent) => {
    try {
      const response = await fetch(`/api/routing-forms/${form.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !form.is_active }),
      });
      if (!response.ok) throw new Error('Failed to update form');
      setForms(forms.map(f => f.id === form.id ? { ...f, is_active: !f.is_active } : f));
    } catch (err) {
      console.error('Failed to toggle form:', err);
    }
  };

  if (loading) {
    return (
      <PageContainer>
        <PageHeader
          title="Routing"
          description="Create forms that route attendees to the right session or host."
        />
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-48 mb-4" />
          <div className="h-4 bg-gray-200 rounded w-96 mb-8" />
          <div className="h-64 bg-gray-200 rounded" />
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Routing"
        description="Create forms that route attendees to the right session or host."
        action={
          <LinkButton href="/admin/routing/new">
            Create routing form
          </LinkButton>
        }
      />

        {error && (
          <div className="bg-red-50 text-red-700 p-4 rounded-lg mb-6">{error}</div>
        )}

        {forms.length === 0 ? (
          <div className="bg-white rounded-xl border border-[#E0E0E0] p-12 text-center">
            <div className="w-14 h-14 bg-[#6F71EE]/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-[#6F71EE]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-[#101E57] mb-2">No routing forms yet</h3>
            <p className="text-[#667085] mb-6 max-w-md mx-auto">
              Routing forms help you ask a few questions before booking, then direct attendees to the most relevant session or host.
            </p>
            <Link
              href="/admin/routing/new"
              className="inline-flex items-center gap-2 bg-[#101E57] text-white px-5 py-2.5 rounded-lg font-medium hover:bg-[#1a2d6e] transition"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create your first routing form
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-[#E0E0E0] overflow-hidden">
            <div className="divide-y divide-[#E0E0E0]">
              {forms.map((form) => (
                <div key={form.id} className="p-6 hover:bg-[#FAFAFA] transition">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Link
                          href={`/admin/routing/${form.id}`}
                          className="text-lg font-semibold text-[#101E57] hover:text-[#6F71EE] transition"
                        >
                          {form.name}
                        </Link>
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                          form.is_active
                            ? 'bg-green-50 text-green-700'
                            : 'bg-gray-100 text-[#667085]'
                        }`}>
                          {form.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      {form.description && (
                        <p className="text-[#667085] text-sm mb-3">{form.description}</p>
                      )}
                      <div className="flex items-center gap-4 text-sm text-[#667085]">
                        <span>{form.questions.length} question{form.questions.length !== 1 ? 's' : ''}</span>
                        <span>{form.submission_count} submission{form.submission_count !== 1 ? 's' : ''}</span>
                        {form.default_event && (
                          <span>Default: {form.default_event.name}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => toggleActive(form)}
                        className={`px-3 py-1.5 text-sm font-medium rounded-lg transition ${
                          form.is_active
                            ? 'text-red-600 hover:bg-red-50'
                            : 'text-green-600 hover:bg-green-50'
                        }`}
                      >
                        {form.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                      <Link
                        href={`/admin/routing/${form.id}`}
                        className="px-3 py-1.5 text-sm font-medium text-[#6F71EE] hover:bg-[#6F71EE]/10 rounded-lg transition"
                      >
                        Edit
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
    </PageContainer>
  );
}

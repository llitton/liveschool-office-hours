'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import AdminNav from '@/components/AdminNav';
import type { OHEvent, RoutingQuestion } from '@/types';

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
  default_event: Pick<OHEvent, 'id' | 'name' | 'slug'> | null;
}

export default function RoutingFormsPage() {
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
      fetchForms();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update form');
    }
  };

  const deleteForm = async (formId: string) => {
    if (!confirm('Are you sure you want to delete this routing form?')) return;

    try {
      const response = await fetch(`/api/routing-forms/${formId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete form');
      fetchForms();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete form');
    }
  };

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

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-[#101E57]">Routing Forms</h1>
            <p className="text-[#667085] mt-1">
              Create intake forms that route visitors to the right session
            </p>
          </div>
          <Link
            href="/admin/routing/new"
            className="bg-[#6F71EE] text-white px-4 py-2 rounded-lg font-medium hover:bg-[#5B5DD6] transition"
          >
            Create Routing Form
          </Link>
        </div>

        {error && (
          <div className="bg-red-50 text-red-700 p-4 rounded-lg mb-6">{error}</div>
        )}

        {loading ? (
          <div className="text-center py-12 text-[#667085]">Loading routing forms...</div>
        ) : forms.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="divide-y divide-gray-200">
              {forms.map((form) => (
                <div
                  key={form.id}
                  className="p-4 flex items-center justify-between hover:bg-gray-50"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        form.is_active ? 'bg-[#417762]' : 'bg-gray-300'
                      }`}
                    />
                    <div>
                      <Link
                        href={`/admin/routing/${form.id}`}
                        className="font-medium text-[#101E57] hover:text-[#6F71EE]"
                      >
                        {form.name}
                      </Link>
                      <div className="text-sm text-[#667085] flex items-center gap-3 mt-1">
                        <span>
                          {form.questions?.length || 0} question
                          {(form.questions?.length || 0) !== 1 ? 's' : ''}
                        </span>
                        <span>·</span>
                        <span>{form.submission_count} submissions</span>
                        {form.default_event && (
                          <>
                            <span>·</span>
                            <span>Default: {form.default_event.name}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <a
                      href={`/route/${form.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-[#6F71EE] hover:text-[#5B5DD6]"
                    >
                      Preview
                    </a>
                    <button
                      onClick={() => navigator.clipboard.writeText(`${window.location.origin}/route/${form.slug}`)}
                      className="text-sm text-[#667085] hover:text-[#101E57]"
                    >
                      Copy Link
                    </button>
                    <button
                      onClick={() => toggleActive(form)}
                      className={`text-sm ${
                        form.is_active
                          ? 'text-[#667085] hover:text-red-600'
                          : 'text-[#417762] hover:text-[#356854]'
                      }`}
                    >
                      {form.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                    <Link
                      href={`/admin/routing/${form.id}`}
                      className="text-sm text-[#667085] hover:text-[#101E57]"
                    >
                      Edit
                    </Link>
                    <button
                      onClick={() => deleteForm(form.id)}
                      className="text-sm text-red-600 hover:text-red-700"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
      <div className="w-16 h-16 bg-[#6F71EE]/10 rounded-full flex items-center justify-center mx-auto mb-4">
        <svg
          className="w-8 h-8 text-[#6F71EE]"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
          />
        </svg>
      </div>
      <h3 className="text-xl font-semibold text-[#101E57] mb-2">No routing forms yet</h3>
      <p className="text-[#667085] max-w-md mx-auto mb-6">
        Routing forms help you triage visitors by asking qualifying questions and
        directing them to the right session or host.
      </p>
      <Link
        href="/admin/routing/new"
        className="inline-flex items-center gap-2 bg-[#6F71EE] text-white px-4 py-2 rounded-lg font-medium hover:bg-[#5B5DD6] transition"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Create Your First Routing Form
      </Link>
    </div>
  );
}

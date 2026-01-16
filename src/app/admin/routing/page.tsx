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
    if (!confirm('Delete this routing form?')) return;

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

      <main className="max-w-4xl mx-auto px-4 py-8">
        {error && (
          <div className="bg-red-50 text-red-700 p-3 rounded-lg mb-4 text-sm">{error}</div>
        )}

        {loading ? (
          <div className="animate-pulse h-32 bg-gray-200 rounded-lg" />
        ) : forms.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
            <h1 className="text-xl font-semibold text-[#101E57] mb-2">
              Send the right people to the right session
            </h1>
            <p className="text-[#667085] mb-6 max-w-md mx-auto">
              Admins go to Office Hours. Teachers go to Student Shopping.
              <br />One link handles both.
            </p>
            <Link
              href="/admin/routing/new"
              className="inline-flex items-center gap-2 bg-[#6F71EE] text-white px-5 py-2.5 rounded-lg font-medium hover:bg-[#5B5DD6] transition"
            >
              Create Routing Form
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h1 className="text-xl font-semibold text-[#101E57]">Routing Forms</h1>
              <Link
                href="/admin/routing/new"
                className="bg-[#6F71EE] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#5B5DD6] transition"
              >
                New Form
              </Link>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 divide-y divide-gray-100">
              {forms.map((form) => (
                <div
                  key={form.id}
                  className="p-4 flex items-center justify-between hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        form.is_active ? 'bg-green-500' : 'bg-gray-300'
                      }`}
                    />
                    <div>
                      <Link
                        href={`/admin/routing/${form.id}`}
                        className="font-medium text-[#101E57] hover:text-[#6F71EE]"
                      >
                        {form.name}
                      </Link>
                      <div className="text-sm text-[#667085]">
                        {form.submission_count} submission{form.submission_count !== 1 ? 's' : ''}
                        {form.default_event && ` · Default: ${form.default_event.name}`}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => navigator.clipboard.writeText(`${window.location.origin}/route/${form.slug}`)}
                      className="text-sm text-[#6F71EE] hover:underline"
                    >
                      Copy Link
                    </button>
                    <button
                      onClick={() => toggleActive(form)}
                      className="text-sm text-[#667085] hover:text-[#101E57]"
                    >
                      {form.is_active ? 'Pause' : 'Activate'}
                    </button>
                    <Link
                      href={`/admin/routing/${form.id}`}
                      className="text-sm text-[#667085] hover:text-[#101E57]"
                    >
                      Edit
                    </Link>
                    <button
                      onClick={() => deleteForm(form.id)}
                      className="text-sm text-red-500 hover:text-red-600"
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

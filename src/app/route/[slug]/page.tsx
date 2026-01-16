'use client';

import { useState, useEffect, use } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import type { RoutingQuestion } from '@/types';

interface RoutingFormData {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  questions: RoutingQuestion[];
}

export default function RoutingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const router = useRouter();

  const [form, setForm] = useState<RoutingFormData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [responses, setResponses] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchForm();
  }, [slug]);

  const fetchForm = async () => {
    try {
      const response = await fetch(`/api/routing-forms/by-slug/${slug}`);
      if (!response.ok) {
        throw new Error('Form not found');
      }
      const data = await response.json();
      setForm(data.form);

      // Initialize responses with empty values for required fields
      const initialResponses: Record<string, string> = {};
      data.form.questions.forEach((q: RoutingQuestion) => {
        initialResponses[q.id] = '';
      });
      setResponses(initialResponses);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load form');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;

    // Validate required fields
    const missingRequired = form.questions.filter(
      (q) => q.required && !responses[q.id]?.trim()
    );

    if (missingRequired.length > 0) {
      setError(`Please answer all required questions`);
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const response = await fetch(`/api/routing-forms/${form.id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ responses }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to submit form');
      }

      const data = await response.json();
      router.push(data.redirectUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit form');
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F6F6F9] flex items-center justify-center">
        <div className="text-[#667085]">Loading...</div>
      </div>
    );
  }

  if (error && !form) {
    return (
      <div className="min-h-screen bg-[#F6F6F9] flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-[#101E57] mb-2">Form Not Found</h1>
          <p className="text-[#667085]">This routing form doesn&apos;t exist or is no longer active.</p>
        </div>
      </div>
    );
  }

  if (!form) return null;

  return (
    <div className="min-h-screen bg-[#F6F6F9]">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <Image
            src="https://info.whyliveschool.com/hubfs/Brand/liveschool-logo.png"
            alt="LiveSchool"
            width={140}
            height={36}
          />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="bg-white rounded-xl shadow-lg p-8">
          {/* Form Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-semibold text-[#101E57] mb-2">{form.name}</h1>
            {form.description && (
              <p className="text-[#667085]">{form.description}</p>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 text-red-700 p-3 rounded-lg mb-6 text-sm">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {form.questions.map((question) => (
              <div key={question.id}>
                <label className="block text-sm font-medium text-[#101E57] mb-2">
                  {question.question}
                  {question.required && <span className="text-red-500 ml-1">*</span>}
                </label>

                {question.type === 'text' && (
                  <input
                    type="text"
                    value={responses[question.id] || ''}
                    onChange={(e) =>
                      setResponses({ ...responses, [question.id]: e.target.value })
                    }
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57]"
                    placeholder="Your answer"
                  />
                )}

                {question.type === 'select' && question.options && (
                  <select
                    value={responses[question.id] || ''}
                    onChange={(e) =>
                      setResponses({ ...responses, [question.id]: e.target.value })
                    }
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57]"
                  >
                    <option value="">Select an option...</option>
                    {question.options.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                )}

                {question.type === 'radio' && question.options && (
                  <div className="space-y-2">
                    {question.options.map((option) => (
                      <label
                        key={option}
                        className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition ${
                          responses[question.id] === option
                            ? 'border-[#6F71EE] bg-[#6F71EE]/5'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <input
                          type="radio"
                          name={question.id}
                          value={option}
                          checked={responses[question.id] === option}
                          onChange={(e) =>
                            setResponses({ ...responses, [question.id]: e.target.value })
                          }
                          className="w-4 h-4 text-[#6F71EE] focus:ring-[#6F71EE]"
                        />
                        <span className="text-[#101E57]">{option}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {/* Submit Button */}
            <div className="pt-4">
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-[#6F71EE] text-white py-3 px-6 rounded-lg font-medium hover:bg-[#5B5DD6] disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Finding the right session...
                  </span>
                ) : (
                  'Find the Right Session →'
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="text-center mt-6 text-sm text-[#667085]">
          Powered by LiveSchool Connect
        </div>
      </main>
    </div>
  );
}

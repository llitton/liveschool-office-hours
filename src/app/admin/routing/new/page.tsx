'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import AdminNav from '@/components/AdminNav';
import type { RoutingQuestion, OHEvent } from '@/types';

export default function NewRoutingFormPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [events, setEvents] = useState<OHEvent[]>([]);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [defaultEventId, setDefaultEventId] = useState<string>('');
  const [questions, setQuestions] = useState<RoutingQuestion[]>([
    { id: crypto.randomUUID(), question: '', type: 'radio', required: true, options: [] },
  ]);

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      const response = await fetch('/api/events');
      if (!response.ok) throw new Error('Failed to load events');
      const data = await response.json();
      setEvents(data.filter((e: OHEvent) => e.is_active));
    } catch (err) {
      console.error('Failed to load events:', err);
    }
  };

  const addQuestion = () => {
    setQuestions([
      ...questions,
      { id: crypto.randomUUID(), question: '', type: 'radio', required: true, options: [] },
    ]);
  };

  const updateQuestion = (id: string, updates: Partial<RoutingQuestion>) => {
    setQuestions(
      questions.map((q) => (q.id === id ? { ...q, ...updates } : q))
    );
  };

  const removeQuestion = (id: string) => {
    if (questions.length <= 1) return;
    setQuestions(questions.filter((q) => q.id !== id));
  };

  const addOption = (questionId: string) => {
    const question = questions.find((q) => q.id === questionId);
    if (!question) return;
    updateQuestion(questionId, {
      options: [...(question.options || []), ''],
    });
  };

  const updateOption = (questionId: string, index: number, value: string) => {
    const question = questions.find((q) => q.id === questionId);
    if (!question || !question.options) return;
    const newOptions = [...question.options];
    newOptions[index] = value;
    updateQuestion(questionId, { options: newOptions });
  };

  const removeOption = (questionId: string, index: number) => {
    const question = questions.find((q) => q.id === questionId);
    if (!question || !question.options) return;
    updateQuestion(questionId, {
      options: question.options.filter((_, i) => i !== index),
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please enter a form name');
      return;
    }

    // Validate questions
    for (const q of questions) {
      if (!q.question.trim()) {
        setError('Please enter text for all questions');
        return;
      }
      if ((q.type === 'radio' || q.type === 'select') && (!q.options || q.options.length < 2)) {
        setError('Radio and select questions need at least 2 options');
        return;
      }
    }

    setSaving(true);
    setError('');

    try {
      const response = await fetch('/api/routing-forms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description: description || null,
          default_event_id: defaultEventId || null,
          questions: questions.map((q) => ({
            ...q,
            options: q.options?.filter((o) => o.trim()),
          })),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create routing form');
      }

      const data = await response.json();
      router.push(`/admin/routing/${data.form.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create form');
      setSaving(false);
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

      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="mb-6">
          <button
            onClick={() => router.back()}
            className="text-[#667085] hover:text-[#101E57] text-sm flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Routing Forms
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h1 className="text-2xl font-semibold text-[#101E57] mb-6">Create Routing Form</h1>

          {error && (
            <div className="bg-red-50 text-red-700 p-4 rounded-lg mb-6">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Info */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#101E57] mb-1">
                  Form Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Product Support Intake"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#101E57] mb-1">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Help visitors understand what this form is for..."
                  rows={2}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57] resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#101E57] mb-1">
                  Default Event (fallback if no rules match)
                </label>
                <select
                  value={defaultEventId}
                  onChange={(e) => setDefaultEventId(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57]"
                >
                  <option value="">Select an event...</option>
                  {events.map((event) => (
                    <option key={event.id} value={event.id}>
                      {event.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Questions */}
            <div className="border-t border-gray-200 pt-6">
              <h2 className="text-lg font-semibold text-[#101E57] mb-4">Questions</h2>

              <div className="space-y-6">
                {questions.map((question, index) => (
                  <div
                    key={question.id}
                    className="bg-[#F6F6F9] rounded-lg p-4 relative"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <span className="text-sm font-medium text-[#667085]">
                        Question {index + 1}
                      </span>
                      {questions.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeQuestion(question.id)}
                          className="text-red-600 hover:text-red-700 text-sm"
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    <div className="space-y-3">
                      <input
                        type="text"
                        value={question.question}
                        onChange={(e) =>
                          updateQuestion(question.id, { question: e.target.value })
                        }
                        placeholder="Enter your question"
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57] bg-white"
                      />

                      <div className="flex items-center gap-4">
                        <select
                          value={question.type}
                          onChange={(e) =>
                            updateQuestion(question.id, {
                              type: e.target.value as 'text' | 'select' | 'radio',
                            })
                          }
                          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57] text-sm bg-white"
                        >
                          <option value="radio">Radio buttons</option>
                          <option value="select">Dropdown</option>
                          <option value="text">Text input</option>
                        </select>

                        <label className="flex items-center gap-2 text-sm text-[#667085]">
                          <input
                            type="checkbox"
                            checked={question.required}
                            onChange={(e) =>
                              updateQuestion(question.id, { required: e.target.checked })
                            }
                            className="rounded text-[#6F71EE] focus:ring-[#6F71EE]"
                          />
                          Required
                        </label>
                      </div>

                      {/* Options for radio/select */}
                      {(question.type === 'radio' || question.type === 'select') && (
                        <div className="mt-3 space-y-2">
                          <label className="text-sm font-medium text-[#667085]">Options</label>
                          {question.options?.map((option, optIndex) => (
                            <div key={optIndex} className="flex items-center gap-2">
                              <input
                                type="text"
                                value={option}
                                onChange={(e) =>
                                  updateOption(question.id, optIndex, e.target.value)
                                }
                                placeholder={`Option ${optIndex + 1}`}
                                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57] text-sm bg-white"
                              />
                              <button
                                type="button"
                                onClick={() => removeOption(question.id, optIndex)}
                                className="text-red-600 hover:text-red-700 p-1"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          ))}
                          <button
                            type="button"
                            onClick={() => addOption(question.id)}
                            className="text-sm text-[#6F71EE] hover:text-[#5B5DD6] flex items-center gap-1"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Add option
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={addQuestion}
                className="mt-4 text-[#6F71EE] hover:text-[#5B5DD6] font-medium flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Question
              </button>
            </div>

            {/* Actions */}
            <div className="border-t border-gray-200 pt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => router.back()}
                className="px-4 py-2 border border-gray-300 rounded-lg text-[#667085] hover:text-[#101E57] hover:border-gray-400 font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="bg-[#6F71EE] text-white px-6 py-2 rounded-lg font-medium hover:bg-[#5B5DD6] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Creating...' : 'Create Form'}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}

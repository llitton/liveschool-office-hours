'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import AdminNav from '@/components/AdminNav';
import type { RoutingQuestion, OHEvent, OHAdmin } from '@/types';

interface RuleWithJoins {
  id: string;
  routing_form_id: string;
  question_id: string;
  answer_value: string;
  target_event_id: string;
  target_host_id: string | null;
  priority: number;
  is_active: boolean;
  created_at: string;
  target_event: Pick<OHEvent, 'id' | 'name' | 'slug'> | null;
  target_host: Pick<OHAdmin, 'id' | 'name' | 'email' | 'profile_image'> | null;
}

interface FormWithRules {
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
  rules: RuleWithJoins[];
}

export default function EditRoutingFormPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [form, setForm] = useState<FormWithRules | null>(null);
  const [events, setEvents] = useState<OHEvent[]>([]);
  const [hosts, setHosts] = useState<OHAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Edit state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [defaultEventId, setDefaultEventId] = useState<string>('');
  const [questions, setQuestions] = useState<RoutingQuestion[]>([]);

  // New rule state
  const [showAddRule, setShowAddRule] = useState(false);
  const [newRule, setNewRule] = useState({
    question_id: '',
    answer_value: '',
    target_event_id: '',
    target_host_id: '',
  });

  useEffect(() => {
    fetchForm();
    fetchEvents();
    fetchHosts();
  }, [id]);

  const fetchForm = async () => {
    try {
      const response = await fetch(`/api/routing-forms/${id}`);
      if (!response.ok) throw new Error('Failed to load routing form');
      const data = await response.json();
      setForm(data.form);
      setName(data.form.name);
      setDescription(data.form.description || '');
      setDefaultEventId(data.form.default_event_id || '');
      setQuestions(data.form.questions || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load form');
    } finally {
      setLoading(false);
    }
  };

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

  const fetchHosts = async () => {
    try {
      const response = await fetch('/api/admin/team');
      if (!response.ok) return;
      const data = await response.json();
      setHosts(data.members || []);
    } catch (err) {
      console.error('Failed to load hosts:', err);
    }
  };

  const addQuestion = () => {
    setQuestions([
      ...questions,
      { id: crypto.randomUUID(), question: '', type: 'radio', required: true, options: [] },
    ]);
  };

  const updateQuestion = (questionId: string, updates: Partial<RoutingQuestion>) => {
    setQuestions(questions.map((q) => (q.id === questionId ? { ...q, ...updates } : q)));
  };

  const removeQuestion = (questionId: string) => {
    if (questions.length <= 1) return;
    setQuestions(questions.filter((q) => q.id !== questionId));
  };

  const addOption = (questionId: string) => {
    const question = questions.find((q) => q.id === questionId);
    if (!question) return;
    updateQuestion(questionId, { options: [...(question.options || []), ''] });
  };

  const updateOption = (questionId: string, index: number, value: string) => {
    const question = questions.find((q) => q.id === questionId);
    if (!question?.options) return;
    const newOptions = [...question.options];
    newOptions[index] = value;
    updateQuestion(questionId, { options: newOptions });
  };

  const removeOption = (questionId: string, index: number) => {
    const question = questions.find((q) => q.id === questionId);
    if (!question?.options) return;
    updateQuestion(questionId, { options: question.options.filter((_, i) => i !== index) });
  };

  const handleSaveForm = async () => {
    if (!name.trim()) {
      setError('Please enter a form name');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const response = await fetch(`/api/routing-forms/${id}`, {
        method: 'PATCH',
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
        throw new Error(data.error || 'Failed to save form');
      }

      setSuccessMessage('Form saved successfully');
      setTimeout(() => setSuccessMessage(''), 3000);
      fetchForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save form');
    } finally {
      setSaving(false);
    }
  };

  const handleAddRule = async () => {
    if (!newRule.question_id || !newRule.answer_value || !newRule.target_event_id) {
      setError('Please fill in all required fields for the rule');
      return;
    }

    try {
      const response = await fetch(`/api/routing-forms/${id}/rules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question_id: newRule.question_id,
          answer_value: newRule.answer_value,
          target_event_id: newRule.target_event_id,
          target_host_id: newRule.target_host_id || null,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to add rule');
      }

      setNewRule({ question_id: '', answer_value: '', target_event_id: '', target_host_id: '' });
      setShowAddRule(false);
      fetchForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add rule');
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    if (!confirm('Are you sure you want to delete this rule?')) return;

    try {
      const response = await fetch(`/api/routing-forms/${id}/rules?rule_id=${ruleId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete rule');
      }

      fetchForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete rule');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F6F6F9] flex items-center justify-center">
        <div className="text-[#667085]">Loading...</div>
      </div>
    );
  }

  if (!form) {
    return (
      <div className="min-h-screen bg-[#F6F6F9] flex items-center justify-center">
        <div className="text-red-600">Routing form not found</div>
      </div>
    );
  }

  // Get all answer options from all questions with options
  const getAllAnswerOptions = (questionId: string) => {
    const question = questions.find((q) => q.id === questionId);
    return question?.options || [];
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
        <div className="mb-6 flex items-center justify-between">
          <button
            onClick={() => router.push('/admin/routing')}
            className="text-[#667085] hover:text-[#101E57] text-sm flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Routing Forms
          </button>
          <a
            href={`/route/${form.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#6F71EE] hover:text-[#5B5DD6] text-sm flex items-center gap-1"
          >
            Preview Form
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>

        {error && (
          <div className="bg-red-50 text-red-700 p-4 rounded-lg mb-6">{error}</div>
        )}

        {successMessage && (
          <div className="bg-green-50 text-green-700 p-4 rounded-lg mb-6">{successMessage}</div>
        )}

        {/* Form Settings */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-[#101E57] mb-4">Form Settings</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#101E57] mb-1">
                Form Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
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
                rows={2}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57] resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#101E57] mb-1">
                Default Event (fallback)
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

            <div className="text-sm text-[#667085]">
              Form URL: <code className="bg-gray-100 px-2 py-0.5 rounded">/route/{form.slug}</code>
            </div>
          </div>
        </div>

        {/* Questions */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-[#101E57] mb-4">Questions</h2>

          <div className="space-y-4">
            {questions.map((question, index) => (
              <div key={question.id} className="bg-[#F6F6F9] rounded-lg p-4">
                <div className="flex items-start justify-between mb-3">
                  <span className="text-sm font-medium text-[#667085]">Question {index + 1}</span>
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
                    onChange={(e) => updateQuestion(question.id, { question: e.target.value })}
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
                        onChange={(e) => updateQuestion(question.id, { required: e.target.checked })}
                        className="rounded text-[#6F71EE] focus:ring-[#6F71EE]"
                      />
                      Required
                    </label>
                  </div>

                  {(question.type === 'radio' || question.type === 'select') && (
                    <div className="mt-3 space-y-2">
                      <label className="text-sm font-medium text-[#667085]">Options</label>
                      {question.options?.map((option, optIndex) => (
                        <div key={optIndex} className="flex items-center gap-2">
                          <input
                            type="text"
                            value={option}
                            onChange={(e) => updateOption(question.id, optIndex, e.target.value)}
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

          <div className="mt-6 pt-4 border-t border-gray-200 flex justify-end">
            <button
              onClick={handleSaveForm}
              disabled={saving}
              className="bg-[#6F71EE] text-white px-6 py-2 rounded-lg font-medium hover:bg-[#5B5DD6] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>

        {/* Routing Rules */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-[#101E57]">Routing Rules</h2>
            <button
              onClick={() => setShowAddRule(true)}
              className="text-[#6F71EE] hover:text-[#5B5DD6] font-medium flex items-center gap-1 text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Rule
            </button>
          </div>

          <p className="text-sm text-[#667085] mb-4">
            Rules determine where visitors are routed based on their answers. Rules are evaluated in order - the first matching rule wins.
          </p>

          {form.rules.length === 0 ? (
            <div className="text-center py-8 text-[#667085]">
              <p>No rules configured yet.</p>
              <p className="text-sm mt-1">
                Without rules, all submissions will go to the default event.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {form.rules.map((rule, index) => {
                const question = questions.find((q) => q.id === rule.question_id);
                return (
                  <div
                    key={rule.id}
                    className="flex items-center justify-between p-4 bg-[#F6F6F9] rounded-lg"
                  >
                    <div className="flex items-center gap-4">
                      <span className="text-sm font-medium text-[#667085] w-6">
                        #{index + 1}
                      </span>
                      <div>
                        <div className="text-sm text-[#101E57]">
                          If{' '}
                          <span className="font-medium">
                            &quot;{question?.question || 'Unknown question'}&quot;
                          </span>{' '}
                          ={' '}
                          <span className="font-medium text-[#6F71EE]">
                            &quot;{rule.answer_value}&quot;
                          </span>
                        </div>
                        <div className="text-sm text-[#667085] mt-1">
                          Route to:{' '}
                          <span className="font-medium text-[#101E57]">
                            {rule.target_event?.name || 'Unknown event'}
                          </span>
                          {rule.target_host && (
                            <span className="ml-2">
                              (Host: {rule.target_host.name || rule.target_host.email})
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteRule(rule.id)}
                      className="text-red-600 hover:text-red-700 text-sm"
                    >
                      Delete
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Add Rule Form */}
          {showAddRule && (
            <div className="mt-4 p-4 border border-[#6F71EE] rounded-lg bg-[#6F71EE]/5">
              <h3 className="font-medium text-[#101E57] mb-4">Add New Rule</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-[#101E57] mb-1">
                      When question <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={newRule.question_id}
                      onChange={(e) =>
                        setNewRule({ ...newRule, question_id: e.target.value, answer_value: '' })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57] text-sm"
                    >
                      <option value="">Select question...</option>
                      {questions
                        .filter((q) => q.type !== 'text')
                        .map((q) => (
                          <option key={q.id} value={q.id}>
                            {q.question}
                          </option>
                        ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[#101E57] mb-1">
                      Equals <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={newRule.answer_value}
                      onChange={(e) => setNewRule({ ...newRule, answer_value: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57] text-sm"
                      disabled={!newRule.question_id}
                    >
                      <option value="">Select answer...</option>
                      {getAllAnswerOptions(newRule.question_id).map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-[#101E57] mb-1">
                      Route to event <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={newRule.target_event_id}
                      onChange={(e) => setNewRule({ ...newRule, target_event_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57] text-sm"
                    >
                      <option value="">Select event...</option>
                      {events.map((event) => (
                        <option key={event.id} value={event.id}>
                          {event.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[#101E57] mb-1">
                      Assign to host (optional)
                    </label>
                    <select
                      value={newRule.target_host_id}
                      onChange={(e) => setNewRule({ ...newRule, target_host_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57] text-sm"
                    >
                      <option value="">Use default assignment</option>
                      {hosts.map((host) => (
                        <option key={host.id} value={host.id}>
                          {host.name || host.email}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => {
                      setShowAddRule(false);
                      setNewRule({ question_id: '', answer_value: '', target_event_id: '', target_host_id: '' });
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-[#667085] hover:text-[#101E57] text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddRule}
                    className="bg-[#6F71EE] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#5B5DD6]"
                  >
                    Add Rule
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

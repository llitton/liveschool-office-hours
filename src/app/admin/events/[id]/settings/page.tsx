'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import type { OHEvent, CustomQuestion } from '@/types';
import Breadcrumb from '@/components/Breadcrumb';

export default function EventSettingsPage({
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

  // Form state
  const [customQuestions, setCustomQuestions] = useState<CustomQuestion[]>([]);
  const [prepMaterials, setPrepMaterials] = useState('');
  const [bannerMode, setBannerMode] = useState<'none' | 'preset' | 'custom'>('none');
  const [bannerImage, setBannerImage] = useState('');
  const [customBannerUrl, setCustomBannerUrl] = useState('');

  // Available preset banners
  const PRESET_BANNERS = [
    { label: 'Default Office Hours', value: '/banners/default-banner.png' },
  ];

  useEffect(() => {
    fetchEvent();
  }, [id]);

  const fetchEvent = async () => {
    try {
      const response = await fetch(`/api/events/${id}`);
      if (!response.ok) throw new Error('Event not found');
      const eventData = await response.json();
      setEvent(eventData);
      setCustomQuestions(eventData.custom_questions || []);
      setPrepMaterials(eventData.prep_materials || '');

      // Set banner state
      const currentBanner = eventData.banner_image || '';
      setBannerImage(currentBanner);
      if (!currentBanner) {
        setBannerMode('none');
      } else if (PRESET_BANNERS.some((b) => b.value === currentBanner)) {
        setBannerMode('preset');
      } else {
        setBannerMode('custom');
        setCustomBannerUrl(currentBanner);
      }
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

    // Determine banner_image value based on mode
    let finalBannerImage: string | null = null;
    if (bannerMode === 'preset') {
      finalBannerImage = bannerImage || PRESET_BANNERS[0]?.value || null;
    } else if (bannerMode === 'custom' && customBannerUrl.trim()) {
      finalBannerImage = customBannerUrl.trim();
    }

    try {
      const response = await fetch(`/api/events/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          custom_questions: customQuestions,
          prep_materials: prepMaterials,
          banner_image: finalBannerImage,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save settings');
      }

      setSuccess('Settings saved successfully!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const addQuestion = () => {
    const newQuestion: CustomQuestion = {
      id: `q_${Date.now()}`,
      question: '',
      type: 'text',
      required: false,
    };
    setCustomQuestions([...customQuestions, newQuestion]);
  };

  const updateQuestion = (index: number, updates: Partial<CustomQuestion>) => {
    setCustomQuestions((prev) =>
      prev.map((q, i) => (i === index ? { ...q, ...updates } : q))
    );
  };

  const removeQuestion = (index: number) => {
    setCustomQuestions((prev) => prev.filter((_, i) => i !== index));
  };

  const moveQuestion = (index: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === customQuestions.length - 1)
    ) {
      return;
    }
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    const updated = [...customQuestions];
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
    setCustomQuestions(updated);
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
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
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
              { label: 'Settings' },
            ]}
          />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-semibold text-[#101E57] mb-2">Event Settings</h1>
        <p className="text-[#667085] mb-6">Customize booking questions and preparation materials</p>

        {error && (
          <div className="bg-red-50 text-red-700 p-4 rounded mb-6 text-sm">{error}</div>
        )}

        {success && (
          <div className="bg-green-50 text-green-700 p-4 rounded mb-6 text-sm">{success}</div>
        )}

        {/* Custom Questions */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <h2 className="text-lg font-semibold text-[#101E57] mb-2">Custom Questions</h2>
          <p className="text-sm text-[#667085] mb-6">
            Ask attendees additional questions when they book. For example: "What topics are you hoping to cover?"
          </p>

          {customQuestions.length === 0 ? (
            <div className="text-center py-8 bg-[#F6F6F9] rounded-lg mb-4">
              <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-[#6F71EE]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-[#101E57] font-medium mb-1">No custom questions yet</p>
              <p className="text-[#667085] text-sm max-w-xs mx-auto">
                Add questions to learn what attendees want to discuss before their session.
              </p>
            </div>
          ) : (
            <div className="space-y-4 mb-6">
              {customQuestions.map((question, index) => (
                <div
                  key={question.id}
                  className="border border-gray-200 rounded-lg p-4"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex flex-col gap-1">
                      <button
                        type="button"
                        onClick={() => moveQuestion(index, 'up')}
                        disabled={index === 0}
                        className="text-[#667085] hover:text-[#101E57] disabled:opacity-30"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => moveQuestion(index, 'down')}
                        disabled={index === customQuestions.length - 1}
                        className="text-[#667085] hover:text-[#101E57] disabled:opacity-30"
                      >
                        ↓
                      </button>
                    </div>

                    <div className="flex-1 space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-[#101E57] mb-1">
                          Question
                        </label>
                        <input
                          type="text"
                          value={question.question}
                          onChange={(e) =>
                            updateQuestion(index, { question: e.target.value })
                          }
                          placeholder="e.g., What topics are you hoping to cover?"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57]"
                        />
                      </div>

                      <div className="flex gap-4">
                        <div>
                          <label className="block text-sm font-medium text-[#101E57] mb-1">
                            Answer Type
                          </label>
                          <select
                            value={question.type}
                            onChange={(e) =>
                              updateQuestion(index, {
                                type: e.target.value as 'text' | 'textarea' | 'select',
                              })
                            }
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57]"
                          >
                            <option value="text">Short text</option>
                            <option value="textarea">Long text</option>
                            <option value="select">Dropdown</option>
                          </select>
                        </div>

                        <div className="flex items-end">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={question.required}
                              onChange={(e) =>
                                updateQuestion(index, { required: e.target.checked })
                              }
                              className="w-4 h-4 text-[#6F71EE] border-gray-300 rounded focus:ring-[#6F71EE]"
                            />
                            <span className="text-sm text-[#101E57]">Required</span>
                          </label>
                        </div>
                      </div>

                      {question.type === 'select' && (
                        <div>
                          <label className="block text-sm font-medium text-[#101E57] mb-1">
                            Options (one per line)
                          </label>
                          <textarea
                            value={(question.options || []).join('\n')}
                            onChange={(e) =>
                              updateQuestion(index, {
                                options: e.target.value.split('\n').filter((o) => o.trim()),
                              })
                            }
                            rows={3}
                            placeholder="Option 1&#10;Option 2&#10;Option 3"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57] font-mono text-sm"
                          />
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => removeQuestion(index)}
                      className="text-red-600 hover:text-red-700 text-sm font-medium"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={addQuestion}
            className="px-4 py-2 border border-[#6F71EE] text-[#6F71EE] rounded-lg hover:bg-[#6F71EE] hover:text-white transition font-medium"
          >
            + Add Question
          </button>
        </div>

        {/* Banner Image */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <h2 className="text-lg font-semibold text-[#101E57] mb-2">Banner Image</h2>
          <p className="text-sm text-[#667085] mb-4">
            Add a banner image to display at the top of your public booking page.
          </p>

          {/* Banner Mode Selection */}
          <div className="flex gap-2 mb-4">
            <button
              type="button"
              onClick={() => setBannerMode('none')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                bannerMode === 'none'
                  ? 'bg-[#6F71EE] text-white'
                  : 'bg-gray-100 text-[#667085] hover:bg-gray-200'
              }`}
            >
              No Banner
            </button>
            <button
              type="button"
              onClick={() => {
                setBannerMode('preset');
                setBannerImage(PRESET_BANNERS[0]?.value || '');
              }}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                bannerMode === 'preset'
                  ? 'bg-[#6F71EE] text-white'
                  : 'bg-gray-100 text-[#667085] hover:bg-gray-200'
              }`}
            >
              Use Default
            </button>
            <button
              type="button"
              onClick={() => setBannerMode('custom')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                bannerMode === 'custom'
                  ? 'bg-[#6F71EE] text-white'
                  : 'bg-gray-100 text-[#667085] hover:bg-gray-200'
              }`}
            >
              Custom URL
            </button>
          </div>

          {/* Preset Banner Selection */}
          {bannerMode === 'preset' && (
            <div className="space-y-3">
              {PRESET_BANNERS.map((banner) => (
                <label
                  key={banner.value}
                  className={`flex items-center gap-4 p-4 rounded-lg border-2 cursor-pointer transition ${
                    bannerImage === banner.value
                      ? 'border-[#6F71EE] bg-[#6F71EE]/5'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="preset_banner"
                    checked={bannerImage === banner.value}
                    onChange={() => setBannerImage(banner.value)}
                    className="sr-only"
                  />
                  <div className="relative w-32 h-20 rounded overflow-hidden bg-gray-100">
                    <Image
                      src={banner.value}
                      alt={banner.label}
                      fill
                      className="object-cover"
                    />
                  </div>
                  <span className="font-medium text-[#101E57]">{banner.label}</span>
                </label>
              ))}
            </div>
          )}

          {/* Custom URL Input */}
          {bannerMode === 'custom' && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-[#101E57] mb-1">
                  Image URL
                </label>
                <input
                  type="url"
                  value={customBannerUrl}
                  onChange={(e) => setCustomBannerUrl(e.target.value)}
                  placeholder="https://example.com/your-image.png"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57]"
                />
                <p className="text-xs text-[#667085] mt-1">
                  Enter a URL to an image. Recommended size: 800x300 pixels.
                </p>
              </div>
              {customBannerUrl && (
                <div className="p-4 bg-[#F6F6F9] rounded-lg">
                  <p className="text-sm font-medium text-[#101E57] mb-2">Preview:</p>
                  <div className="relative w-full h-32 rounded overflow-hidden bg-gray-200">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={customBannerUrl}
                      alt="Banner preview"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Prep Materials */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <h2 className="text-lg font-semibold text-[#101E57] mb-2">Preparation Materials</h2>
          <p className="text-sm text-[#667085] mb-4">
            Information shown to attendees on their confirmation page and in their confirmation email.
            Use this for agendas, links to resources, or instructions to prepare.
          </p>

          <textarea
            value={prepMaterials}
            onChange={(e) => setPrepMaterials(e.target.value)}
            rows={6}
            placeholder="Example:&#10;&#10;Before our session, please:&#10;• Review our help docs at https://...&#10;• Have your account login ready&#10;• Prepare 2-3 questions you'd like to discuss"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57]"
          />
        </div>

        {/* Save Button */}
        <div className="flex gap-4">
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-[#6F71EE] text-white px-6 py-2 rounded-lg hover:bg-[#5a5cd0] transition disabled:opacity-50 font-medium"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
          <Link
            href={`/admin/events/${id}`}
            className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition text-[#667085] font-medium"
          >
            Cancel
          </Link>
        </div>
      </main>
    </div>
  );
}

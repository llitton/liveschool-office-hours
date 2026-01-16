'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import type { OHEvent, CustomQuestion, MeetingType, RoundRobinStrategy, RoundRobinPeriod } from '@/types';
import { MEETING_TYPES_NO_MIN_NOTICE } from '@/types';
import Breadcrumb from '@/components/Breadcrumb';
import TimezoneSelector from '@/components/TimezoneSelector';
import RoundRobinHostSelector from '@/components/RoundRobinHostSelector';
import HostSelector from '@/components/HostSelector';
import { RichTextEditor } from '@/components/RichTextEditor';

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
  const [eventName, setEventName] = useState('');
  const [eventSubtitle, setEventSubtitle] = useState('');
  const [eventDescription, setEventDescription] = useState('');
  const [customQuestions, setCustomQuestions] = useState<CustomQuestion[]>([]);
  const [prepMaterials, setPrepMaterials] = useState('');
  const [bannerMode, setBannerMode] = useState<'none' | 'preset' | 'custom'>('none');
  const [bannerImage, setBannerImage] = useState('');
  const [customBannerUrl, setCustomBannerUrl] = useState('');

  // Meeting type
  const [meetingType, setMeetingType] = useState<MeetingType>('group');

  // Booking constraints
  const [minNoticeHours, setMinNoticeHours] = useState(24);
  const [maxDailyBookings, setMaxDailyBookings] = useState<string>('');
  const [maxWeeklyBookings, setMaxWeeklyBookings] = useState<string>('');
  const [bookingWindowDays, setBookingWindowDays] = useState(60);
  const [requireApproval, setRequireApproval] = useState(false);

  // Timezone settings
  const [displayTimezone, setDisplayTimezone] = useState('America/New_York');
  const [lockTimezone, setLockTimezone] = useState(false);

  // Round-robin settings
  const [roundRobinStrategy, setRoundRobinStrategy] = useState<RoundRobinStrategy>('cycle');
  const [roundRobinPeriod, setRoundRobinPeriod] = useState<RoundRobinPeriod>('week');

  // SMS settings
  const [smsRemindersEnabled, setSmsRemindersEnabled] = useState(false);
  const [smsPhoneRequired, setSmsPhoneRequired] = useState(false);
  const [smsReminder24hTemplate, setSmsReminder24hTemplate] = useState('');
  const [smsReminder1hTemplate, setSmsReminder1hTemplate] = useState('');

  // Available preset banners
  const PRESET_BANNERS = [
    { label: 'Default Banner', value: '/banners/default-banner.png' },
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
      setEventName(eventData.name || '');
      setEventSubtitle(eventData.subtitle || '');
      setEventDescription(eventData.description || '');
      setCustomQuestions(eventData.custom_questions || []);
      setPrepMaterials(eventData.prep_materials || '');

      // Set meeting type
      setMeetingType(eventData.meeting_type || 'group');

      // Set booking constraints
      setMinNoticeHours(eventData.min_notice_hours ?? 24);
      setMaxDailyBookings(eventData.max_daily_bookings?.toString() || '');
      setMaxWeeklyBookings(eventData.max_weekly_bookings?.toString() || '');
      setBookingWindowDays(eventData.booking_window_days ?? 60);
      setRequireApproval(eventData.require_approval ?? false);

      // Set timezone settings
      setDisplayTimezone(eventData.display_timezone || 'America/New_York');
      setLockTimezone(eventData.lock_timezone ?? false);

      // Set round-robin settings
      setRoundRobinStrategy(eventData.round_robin_strategy || 'cycle');
      setRoundRobinPeriod(eventData.round_robin_period || 'week');

      // Set SMS settings
      setSmsRemindersEnabled(eventData.sms_reminders_enabled ?? false);
      setSmsPhoneRequired(eventData.sms_phone_required ?? false);
      setSmsReminder24hTemplate(eventData.sms_reminder_24h_template || '');
      setSmsReminder1hTemplate(eventData.sms_reminder_1h_template || '');

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
          name: eventName,
          subtitle: eventSubtitle || null,
          description: eventDescription || null,
          custom_questions: customQuestions,
          prep_materials: prepMaterials,
          banner_image: finalBannerImage,
          // Meeting type
          meeting_type: meetingType,
          // Booking constraints
          min_notice_hours: minNoticeHours,
          max_daily_bookings: maxDailyBookings ? parseInt(maxDailyBookings) : null,
          max_weekly_bookings: maxWeeklyBookings ? parseInt(maxWeeklyBookings) : null,
          booking_window_days: bookingWindowDays,
          require_approval: requireApproval,
          // Timezone settings
          display_timezone: displayTimezone,
          lock_timezone: lockTimezone,
          // Round-robin settings
          round_robin_strategy: meetingType === 'round_robin' ? roundRobinStrategy : null,
          round_robin_period: roundRobinPeriod,
          // SMS settings
          sms_reminders_enabled: smsRemindersEnabled,
          sms_phone_required: smsPhoneRequired,
          sms_reminder_24h_template: smsReminder24hTemplate || null,
          sms_reminder_1h_template: smsReminder1hTemplate || null,
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

        {/* Event Info */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <h2 className="text-lg font-semibold text-[#101E57] mb-2">Event Info</h2>
          <p className="text-sm text-[#667085] mb-6">
            Edit your event&apos;s title, subtitle, and description.
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#101E57] mb-1">
                Event Name
              </label>
              <input
                type="text"
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
                placeholder="e.g., Student Shopping 101"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#101E57] mb-1">
                Subtitle
              </label>
              <input
                type="text"
                value={eventSubtitle}
                onChange={(e) => setEventSubtitle(e.target.value)}
                placeholder="e.g., Open an Amazon.com Style Online Store for Your Students"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57]"
              />
              <p className="text-xs text-[#667085] mt-1">
                Optional tagline shown below the event name on the booking page.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#101E57] mb-1">
                Description
              </label>
              <RichTextEditor
                content={eventDescription}
                onChange={setEventDescription}
                placeholder="Describe what attendees will get from this session..."
              />
            </div>
          </div>
        </div>

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

        {/* Meeting Type */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <h2 className="text-lg font-semibold text-[#101E57] mb-2">Meeting Type</h2>
          <p className="text-sm text-[#667085] mb-4">
            Choose how attendees will be scheduled for this event.
          </p>

          <div className="grid gap-3">
            {(['one_on_one', 'group', 'webinar', 'round_robin'] as MeetingType[]).map((type) => {
              const labels: Record<string, string> = {
                one_on_one: 'One-on-One',
                group: 'Group Session',
                webinar: 'Webinar',
                round_robin: 'Round-Robin',
              };
              const descriptions: Record<string, string> = {
                one_on_one: 'Single host meets with one attendee at a time',
                group: 'Single host meets with multiple attendees (group style)',
                webinar: 'Presentation-style event with set date/time for many attendees',
                round_robin: 'Bookings are automatically distributed across team members',
              };
              return (
                <label
                  key={type}
                  className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition ${
                    meetingType === type
                      ? 'border-[#6F71EE] bg-[#6F71EE]/5'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="meeting_type"
                    value={type}
                    checked={meetingType === type}
                    onChange={() => setMeetingType(type)}
                    className="mt-1 w-4 h-4 text-[#6F71EE] border-gray-300 focus:ring-[#6F71EE]"
                  />
                  <div>
                    <span className="font-medium text-[#101E57]">
                      {labels[type]}
                    </span>
                    <p className="text-sm text-[#667085] mt-0.5">
                      {descriptions[type]}
                    </p>
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        {/* Round-Robin Configuration - Show when round_robin is selected */}
        {meetingType === 'round_robin' && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
            <h2 className="text-lg font-semibold text-[#101E57] mb-2">Round-Robin Settings</h2>
            <p className="text-sm text-[#667085] mb-6">
              Configure how bookings are distributed across your team.
            </p>

            {/* Distribution Strategy */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-[#101E57] mb-3">
                Distribution Strategy
              </label>
              <div className="grid gap-3">
                <label
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition ${
                    roundRobinStrategy === 'cycle'
                      ? 'border-[#6F71EE] bg-[#6F71EE]/5'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="round_robin_strategy"
                    value="cycle"
                    checked={roundRobinStrategy === 'cycle'}
                    onChange={() => setRoundRobinStrategy('cycle')}
                    className="mt-0.5 w-4 h-4 text-[#6F71EE] border-gray-300 focus:ring-[#6F71EE]"
                  />
                  <div>
                    <span className="font-medium text-[#101E57]">Simple Rotation</span>
                    <p className="text-sm text-[#667085]">
                      Rotate through hosts in order, skipping unavailable hosts
                    </p>
                  </div>
                </label>

                <label
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition ${
                    roundRobinStrategy === 'least_bookings'
                      ? 'border-[#6F71EE] bg-[#6F71EE]/5'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="round_robin_strategy"
                    value="least_bookings"
                    checked={roundRobinStrategy === 'least_bookings'}
                    onChange={() => setRoundRobinStrategy('least_bookings')}
                    className="mt-0.5 w-4 h-4 text-[#6F71EE] border-gray-300 focus:ring-[#6F71EE]"
                  />
                  <div>
                    <span className="font-medium text-[#101E57]">Load Balanced</span>
                    <p className="text-sm text-[#667085]">
                      Assign to the host with the fewest bookings in the period
                    </p>
                  </div>
                </label>

                <label
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition ${
                    roundRobinStrategy === 'availability_weighted'
                      ? 'border-[#6F71EE] bg-[#6F71EE]/5'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="round_robin_strategy"
                    value="availability_weighted"
                    checked={roundRobinStrategy === 'availability_weighted'}
                    onChange={() => setRoundRobinStrategy('availability_weighted')}
                    className="mt-0.5 w-4 h-4 text-[#6F71EE] border-gray-300 focus:ring-[#6F71EE]"
                  />
                  <div>
                    <span className="font-medium text-[#101E57]">Availability Weighted</span>
                    <p className="text-sm text-[#667085]">
                      Balance bookings relative to each host&apos;s available hours
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {/* Balancing Period - Only show for load balancing strategies */}
            {roundRobinStrategy !== 'cycle' && (
              <div className="mb-6">
                <label className="block text-sm font-medium text-[#101E57] mb-2">
                  Balancing Period
                </label>
                <select
                  value={roundRobinPeriod}
                  onChange={(e) => setRoundRobinPeriod(e.target.value as RoundRobinPeriod)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57]"
                >
                  <option value="day">Daily</option>
                  <option value="week">Weekly</option>
                  <option value="month">Monthly</option>
                  <option value="all_time">All Time</option>
                </select>
                <p className="text-xs text-[#667085] mt-1">
                  Bookings are balanced within this time period.
                </p>
              </div>
            )}

            {/* Participating Hosts */}
            <div className="pt-4 border-t">
              <label className="block text-sm font-medium text-[#101E57] mb-3">
                Participating Hosts
              </label>
              <RoundRobinHostSelector eventId={id} />
            </div>
          </div>
        )}

        {/* Event Hosts - Show for all meeting types */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <HostSelector eventId={id} />
        </div>

        {/* Booking Constraints - Hidden for webinars since slots have fixed times */}
        {!MEETING_TYPES_NO_MIN_NOTICE.includes(meetingType) && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <h2 className="text-lg font-semibold text-[#101E57] mb-2">Booking Rules</h2>
          <p className="text-sm text-[#667085] mb-6">
            Control when and how attendees can book sessions.
          </p>

          <div className="space-y-6">
            {/* Minimum Notice */}
            <div>
              <label className="block text-sm font-medium text-[#101E57] mb-2">
                Minimum Notice
              </label>
              <div className="flex items-center gap-3">
                <select
                  value={minNoticeHours}
                  onChange={(e) => setMinNoticeHours(parseInt(e.target.value))}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57]"
                >
                  <option value={0}>No minimum</option>
                  <option value={1}>1 hour</option>
                  <option value={2}>2 hours</option>
                  <option value={4}>4 hours</option>
                  <option value={12}>12 hours</option>
                  <option value={24}>24 hours (1 day)</option>
                  <option value={48}>48 hours (2 days)</option>
                  <option value={72}>72 hours (3 days)</option>
                  <option value={168}>1 week</option>
                </select>
                <span className="text-sm text-[#667085]">before the session</span>
              </div>
              <p className="text-xs text-[#667085] mt-1">
                Prevents last-minute bookings. Attendees must book at least this far in advance.
              </p>
            </div>

            {/* Booking Window */}
            <div>
              <label className="block text-sm font-medium text-[#101E57] mb-2">
                Booking Window
              </label>
              <div className="flex items-center gap-3">
                <select
                  value={bookingWindowDays}
                  onChange={(e) => setBookingWindowDays(parseInt(e.target.value))}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57]"
                >
                  <option value={7}>1 week</option>
                  <option value={14}>2 weeks</option>
                  <option value={30}>30 days</option>
                  <option value={60}>60 days</option>
                  <option value={90}>90 days</option>
                  <option value={180}>6 months</option>
                  <option value={365}>1 year</option>
                </select>
                <span className="text-sm text-[#667085]">into the future</span>
              </div>
              <p className="text-xs text-[#667085] mt-1">
                How far in advance attendees can book sessions.
              </p>
            </div>

            {/* Daily/Weekly Limits */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#101E57] mb-2">
                  Max Bookings Per Day
                </label>
                <input
                  type="number"
                  value={maxDailyBookings}
                  onChange={(e) => setMaxDailyBookings(e.target.value)}
                  placeholder="Unlimited"
                  min={1}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#101E57] mb-2">
                  Max Bookings Per Week
                </label>
                <input
                  type="number"
                  value={maxWeeklyBookings}
                  onChange={(e) => setMaxWeeklyBookings(e.target.value)}
                  placeholder="Unlimited"
                  min={1}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57]"
                />
              </div>
            </div>
            <p className="text-xs text-[#667085] -mt-4">
              Leave empty for unlimited. Limits are per event, not per attendee.
            </p>

            {/* Require Approval */}
            <div className="pt-4 border-t">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={requireApproval}
                  onChange={(e) => setRequireApproval(e.target.checked)}
                  className="mt-1 w-4 h-4 text-[#6F71EE] border-gray-300 rounded focus:ring-[#6F71EE]"
                />
                <div>
                  <span className="font-medium text-[#101E57]">Require Approval</span>
                  <p className="text-sm text-[#667085] mt-0.5">
                    Bookings will be pending until you manually approve them.
                    Attendees won&apos;t receive confirmation until approved.
                  </p>
                </div>
              </label>
            </div>
          </div>
        </div>
        )}

        {/* Timezone Settings */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <h2 className="text-lg font-semibold text-[#101E57] mb-2">Timezone</h2>
          <p className="text-sm text-[#667085] mb-4">
            Control how times are displayed on your booking page.
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#101E57] mb-2">
                Display Timezone
              </label>
              <TimezoneSelector
                value={displayTimezone}
                onChange={setDisplayTimezone}
                className="max-w-md"
              />
              <p className="text-xs text-[#667085] mt-1">
                Times will be shown in this timezone by default.
              </p>
            </div>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={lockTimezone}
                onChange={(e) => setLockTimezone(e.target.checked)}
                className="mt-1 w-4 h-4 text-[#6F71EE] border-gray-300 rounded focus:ring-[#6F71EE]"
              />
              <div>
                <span className="font-medium text-[#101E57]">Lock Timezone</span>
                <p className="text-sm text-[#667085] mt-0.5">
                  Always display times in the selected timezone. Disable auto-detection
                  of attendee&apos;s timezone.
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* SMS Reminders */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <h2 className="text-lg font-semibold text-[#101E57] mb-2">SMS Reminders</h2>
          <p className="text-sm text-[#667085] mb-4">
            Send text message reminders to attendees before their session.
          </p>

          <div className="space-y-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={smsRemindersEnabled}
                onChange={(e) => setSmsRemindersEnabled(e.target.checked)}
                className="mt-1 w-4 h-4 text-[#6F71EE] border-gray-300 rounded focus:ring-[#6F71EE]"
              />
              <div>
                <span className="font-medium text-[#101E57]">Enable SMS Reminders</span>
                <p className="text-sm text-[#667085] mt-0.5">
                  Attendees can opt-in to receive text message reminders
                </p>
              </div>
            </label>

            {smsRemindersEnabled && (
              <div className="ml-7 space-y-4 pt-2">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={smsPhoneRequired}
                    onChange={(e) => setSmsPhoneRequired(e.target.checked)}
                    className="mt-1 w-4 h-4 text-[#6F71EE] border-gray-300 rounded focus:ring-[#6F71EE]"
                  />
                  <div>
                    <span className="font-medium text-[#101E57]">Require Phone Number</span>
                    <p className="text-sm text-[#667085] mt-0.5">
                      Make phone number a required field on the booking form
                    </p>
                  </div>
                </label>

                <div>
                  <label className="block text-sm font-medium text-[#101E57] mb-1">
                    24-Hour Reminder Message
                  </label>
                  <textarea
                    value={smsReminder24hTemplate}
                    onChange={(e) => setSmsReminder24hTemplate(e.target.value)}
                    rows={2}
                    maxLength={160}
                    placeholder="Hi {{first_name}}, reminder: {{event_name}} tomorrow at {{time_with_timezone}}. Reply STOP to opt out."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57]"
                  />
                  <p className="text-xs text-[#667085] mt-1">
                    {smsReminder24hTemplate.length}/160 characters. Leave empty to use default.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#101E57] mb-1">
                    1-Hour Reminder Message
                  </label>
                  <textarea
                    value={smsReminder1hTemplate}
                    onChange={(e) => setSmsReminder1hTemplate(e.target.value)}
                    rows={2}
                    maxLength={160}
                    placeholder="Hi {{first_name}}, your {{event_name}} session starts in 1 hour at {{time_with_timezone}}."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57]"
                  />
                  <p className="text-xs text-[#667085] mt-1">
                    {smsReminder1hTemplate.length}/160 characters. Leave empty to use default.
                  </p>
                </div>

                <div className="bg-[#F6F6F9] rounded-lg p-3">
                  <p className="text-xs font-medium text-[#101E57] mb-1">Available template variables:</p>
                  <p className="text-xs text-[#667085]">
                    {'{{first_name}}'}, {'{{last_name}}'}, {'{{event_name}}'}, {'{{time_with_timezone}}'}, {'{{date}}'}
                  </p>
                </div>
              </div>
            )}
          </div>
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

'use client';

import { useState, useEffect, use, useRef, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import type { OHEvent, CustomQuestion, MeetingType, RoundRobinStrategy, RoundRobinPeriod, QuestionType } from '@/types';
import { MEETING_TYPES_NO_MIN_NOTICE } from '@/types';
import Breadcrumb from '@/components/Breadcrumb';
import TimezoneSelector from '@/components/TimezoneSelector';
import RoundRobinHostSelector from '@/components/RoundRobinHostSelector';
import HostSelector from '@/components/HostSelector';
import { RichTextEditor } from '@/components/RichTextEditor';
import TaskTemplatesManager from '@/components/TaskTemplatesManager';
import PrepResourcesManager from '@/components/PrepResourcesManager';
import { SMSPreview } from '@/components/SMSPreview';
import { SMSTestButton } from '@/components/SMSTestButton';
import { SMSProviderWarning } from '@/components/SMSProviderWarning';
import BufferTimeline from '@/components/BufferTimeline';
import BookingPagePreview from '@/components/BookingPagePreview';

// Navigation sections configuration
interface NavSection {
  id: string;
  label: string;
  showFor?: MeetingType[];
  hideFor?: MeetingType[];
}

const NAV_SECTIONS: NavSection[] = [
  { id: 'event-info', label: 'General' },
  { id: 'custom-questions', label: 'Questions' },
  { id: 'banner-image', label: 'Banner', showFor: ['webinar'] },
  { id: 'meeting-type', label: 'Meeting Type' },
  { id: 'round-robin-settings', label: 'Team Settings', showFor: ['round_robin'] },
  { id: 'event-hosts', label: 'Hosts', hideFor: ['one_on_one', 'round_robin'] },
  { id: 'booking-rules', label: 'Booking Rules', hideFor: ['webinar'] },
  { id: 'timezone', label: 'Timezone', hideFor: ['round_robin'] },
  { id: 'hubspot-settings', label: 'HubSpot' },
  { id: 'slack-notifications', label: 'Slack' },
  { id: 'sms-reminders', label: 'SMS Reminders' },
  { id: 'phone-collection', label: 'Phone' },
  { id: 'waitlist', label: 'Waitlist', hideFor: ['one_on_one', 'round_robin'] },
  { id: 'prep-materials', label: 'Prep Materials', showFor: ['webinar'] },
];

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
  const [ignoreBusyBlocks, setIgnoreBusyBlocks] = useState(false);
  const [startTimeIncrement, setStartTimeIncrement] = useState(30);

  // Buffer settings
  const [bufferBefore, setBufferBefore] = useState(0);
  const [bufferAfter, setBufferAfter] = useState(0);

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
  const [smsProviderConnected, setSmsProviderConnected] = useState(false);

  // Phone requirement (independent of SMS)
  const [phoneRequired, setPhoneRequired] = useState(false);

  // Waitlist settings
  const [waitlistEnabled, setWaitlistEnabled] = useState(false);
  const [waitlistLimit, setWaitlistLimit] = useState<string>('');

  // HubSpot integration
  const [hubspotMeetingType, setHubspotMeetingType] = useState<string>('');
  const [hubspotMeetingTypes, setHubspotMeetingTypes] = useState<Array<{ value: string; label: string }>>([]);
  const [hubspotConnected, setHubspotConnected] = useState(false);

  // Slack notifications
  const [slackNotificationsEnabled, setSlackNotificationsEnabled] = useState(false);

  // Navigation state
  const [activeSection, setActiveSection] = useState('event-info');
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Available preset banners
  const PRESET_BANNERS = [
    { label: 'Default Banner', value: '/banners/default-banner.png' },
  ];

  // Get visible nav sections based on meeting type
  const visibleNavSections = NAV_SECTIONS.filter(section => {
    if (section.showFor && !section.showFor.includes(meetingType)) return false;
    if (section.hideFor && section.hideFor.includes(meetingType)) return false;
    return true;
  });

  // Scroll to section
  const scrollToSection = useCallback((sectionId: string) => {
    const el = sectionRefs.current[sectionId];
    if (el) {
      const yOffset = -100; // Account for sticky header
      const y = el.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  }, []);

  // Track active section on scroll
  useEffect(() => {
    const handleScroll = () => {
      const scrollPos = window.scrollY + 150;
      for (const section of visibleNavSections) {
        const el = sectionRefs.current[section.id];
        if (el) {
          const top = el.offsetTop;
          const bottom = top + el.offsetHeight;
          if (scrollPos >= top && scrollPos < bottom) {
            setActiveSection(section.id);
            break;
          }
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [visibleNavSections]);

  useEffect(() => {
    fetchEvent();
    fetchSMSStatus();
    fetchHubSpotMeetingTypes();
  }, [id]);

  const fetchSMSStatus = async () => {
    try {
      const res = await fetch('/api/sms/status');
      if (res.ok) {
        const data = await res.json();
        setSmsProviderConnected(data.connected);
      }
    } catch (err) {
      console.error('Failed to fetch SMS status:', err);
    }
  };

  const fetchHubSpotMeetingTypes = async () => {
    try {
      const res = await fetch('/api/hubspot/meeting-types');
      if (res.ok) {
        const data = await res.json();
        setHubspotConnected(data.connected);
        setHubspotMeetingTypes(data.meetingTypes || []);
      }
    } catch (err) {
      console.error('Failed to fetch HubSpot meeting types:', err);
    }
  };

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
      setIgnoreBusyBlocks(eventData.ignore_busy_blocks ?? false);
      setStartTimeIncrement(eventData.start_time_increment ?? 30);

      // Set buffer settings
      setBufferBefore(eventData.buffer_before ?? 0);
      setBufferAfter(eventData.buffer_after ?? 0);

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

      // Set phone requirement (independent of SMS)
      setPhoneRequired(eventData.phone_required ?? false);

      // Set waitlist settings
      setWaitlistEnabled(eventData.waitlist_enabled ?? false);
      setWaitlistLimit(eventData.waitlist_limit?.toString() || '');

      // Set HubSpot meeting type
      setHubspotMeetingType(eventData.hubspot_meeting_type || '');

      // Set Slack notifications
      setSlackNotificationsEnabled(eventData.slack_notifications_enabled ?? false);

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
          ignore_busy_blocks: ignoreBusyBlocks,
          start_time_increment: startTimeIncrement,
          // Buffer settings
          buffer_before: bufferBefore,
          buffer_after: bufferAfter,
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
          // Phone requirement (independent of SMS)
          phone_required: phoneRequired,
          // Waitlist settings
          waitlist_enabled: waitlistEnabled,
          waitlist_limit: waitlistLimit ? parseInt(waitlistLimit) : null,
          // HubSpot integration
          hubspot_meeting_type: hubspotMeetingType || null,
          // Slack notifications
          slack_notifications_enabled: slackNotificationsEnabled,
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
    <div className="min-h-screen bg-[#F6F6F9] pb-20">
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center gap-4">
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

      <div className="max-w-7xl mx-auto px-4 py-8 flex gap-6">
        {/* Sidebar Navigation */}
        <aside className="w-44 flex-shrink-0 hidden lg:block">
          <nav className="sticky top-24 space-y-1">
            <p className="text-xs font-semibold text-[#667085] uppercase tracking-wider mb-3 px-3">
              Settings
            </p>
            {visibleNavSections.map((section) => (
              <button
                key={section.id}
                onClick={() => scrollToSection(section.id)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition ${
                  activeSection === section.id
                    ? 'bg-[#6F71EE] text-white'
                    : 'text-[#667085] hover:text-[#101E57] hover:bg-white'
                }`}
              >
                {section.label}
              </button>
            ))}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-w-0 max-w-2xl">
          <h1 className="text-2xl font-semibold text-[#101E57] mb-2">Event Settings</h1>
          <p className="text-[#667085] mb-6">Customize booking questions and preparation materials</p>

          {error && (
            <div className="bg-red-50 text-red-700 p-4 rounded mb-6 text-sm">{error}</div>
          )}

        {/* Event Info */}
        <div
          id="event-info"
          ref={(el) => { sectionRefs.current['event-info'] = el; }}
          className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8"
        >
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

            {/* Subtitle - only for webinars */}
            {meetingType === 'webinar' && (
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
            )}

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
        <div
          id="custom-questions"
          ref={(el) => { sectionRefs.current['custom-questions'] = el; }}
          className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8"
        >
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
                                type: e.target.value as QuestionType,
                              })
                            }
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57]"
                          >
                            <option value="text">Short text</option>
                            <option value="textarea">Long text</option>
                            <option value="phone">Phone number</option>
                            <option value="radio">Radio buttons (single choice)</option>
                            <option value="checkbox">Checkboxes (multiple choice)</option>
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

                      {/* Options field for types that need predefined choices */}
                      {(question.type === 'select' || question.type === 'radio' || question.type === 'checkbox') && (
                        <div>
                          <label className="block text-sm font-medium text-[#101E57] mb-1">
                            Options (one per line)
                          </label>
                          <textarea
                            value={(question.options || []).join('\n')}
                            onChange={(e) =>
                              updateQuestion(index, {
                                // Keep all lines while editing (including empty), filter only preserves non-empty on blur/save
                                options: e.target.value.split('\n'),
                              })
                            }
                            onBlur={(e) =>
                              updateQuestion(index, {
                                // Clean up empty lines when user leaves the field
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

        {/* Banner Image - only for webinars */}
        {meetingType === 'webinar' && (
        <div
          id="banner-image"
          ref={(el) => { sectionRefs.current['banner-image'] = el; }}
          className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8"
        >
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
        )}

        {/* Meeting Type */}
        <div
          id="meeting-type"
          ref={(el) => { sectionRefs.current['meeting-type'] = el; }}
          className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8"
        >
          <h2 className="text-lg font-semibold text-[#101E57] mb-2">Meeting Type</h2>
          <p className="text-sm text-[#667085] mb-4">
            Choose how attendees will be scheduled for this event.
          </p>

          <div className="grid gap-3">
            {(['one_on_one', 'group', 'round_robin', 'collective', 'webinar'] as MeetingType[]).map((type) => {
              const labels: Record<string, string> = {
                one_on_one: 'One-on-One',
                group: 'Group Session',
                round_robin: 'Round-Robin',
                collective: 'Collective',
                webinar: 'Webinar',
              };
              const descriptions: Record<string, string> = {
                one_on_one: 'Single host meets with one attendee at a time',
                group: 'Multiple attendees can join. Perfect for office hours or trainings',
                round_robin: 'Bookings are automatically distributed across team members',
                collective: 'All selected hosts must be available for the meeting',
                webinar: 'Scheduled sessions with multiple attendees, all co-hosts must be available',
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
          <div
            id="round-robin-settings"
            ref={(el) => { sectionRefs.current['round-robin-settings'] = el; }}
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8"
          >
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

                <label
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition ${
                    roundRobinStrategy === 'priority'
                      ? 'border-[#6F71EE] bg-[#6F71EE]/5'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="round_robin_strategy"
                    value="priority"
                    checked={roundRobinStrategy === 'priority'}
                    onChange={() => setRoundRobinStrategy('priority')}
                    className="mt-0.5 w-4 h-4 text-[#6F71EE] border-gray-300 focus:ring-[#6F71EE]"
                  />
                  <div>
                    <span className="font-medium text-[#101E57]">Priority Based</span>
                    <p className="text-sm text-[#667085]">
                      Assign to highest priority host first. Set priorities with stars below.
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {/* Balancing Period - Only show for load balancing strategies */}
            {roundRobinStrategy !== 'cycle' && roundRobinStrategy !== 'priority' && (
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
                {roundRobinStrategy === 'priority' && (
                  <span className="ml-2 font-normal text-[#667085]">— click stars to set priority</span>
                )}
              </label>
              <RoundRobinHostSelector eventId={id} showPriority={roundRobinStrategy === 'priority'} />
            </div>
          </div>
        )}

        {/* Event Hosts - Show for collective, group, and webinar (not one-on-one or round-robin) */}
        {/* Round-robin has its own host management in RoundRobinHostSelector above */}
        {meetingType !== 'one_on_one' && meetingType !== 'round_robin' && (
        <div
          id="event-hosts"
          ref={(el) => { sectionRefs.current['event-hosts'] = el; }}
          className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8"
        >
          <HostSelector eventId={id} />
        </div>
        )}

        {/* Booking Constraints - Hidden for webinars since slots have fixed times */}
        {!MEETING_TYPES_NO_MIN_NOTICE.includes(meetingType) && (
        <div
          id="booking-rules"
          ref={(el) => { sectionRefs.current['booking-rules'] = el; }}
          className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8"
        >
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

            {/* Start Time Increments */}
            <div>
              <label className="block text-sm font-medium text-[#101E57] mb-2">
                Start Time Increments
              </label>
              <div className="flex items-center gap-3">
                <select
                  value={startTimeIncrement}
                  onChange={(e) => setStartTimeIncrement(parseInt(e.target.value))}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57]"
                >
                  <option value={15}>15 minutes</option>
                  <option value={30}>30 minutes</option>
                  <option value={45}>45 minutes</option>
                  <option value={60}>60 minutes</option>
                </select>
              </div>
              <p className="text-xs text-[#667085] mt-1">
                How often time slots appear. For example, with 30-minute increments, slots start at 9:00, 9:30, 10:00, etc.
              </p>
            </div>

            {/* Buffer Time */}
            <div>
              <label className="block text-sm font-medium text-[#101E57] mb-2">
                Buffer Time
              </label>
              <div className="grid grid-cols-2 gap-4 mb-3">
                <div>
                  <label className="block text-xs text-[#667085] mb-1">Before session</label>
                  <select
                    value={bufferBefore}
                    onChange={(e) => setBufferBefore(parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57]"
                  >
                    <option value={0}>No buffer</option>
                    <option value={5}>5 minutes</option>
                    <option value={10}>10 minutes</option>
                    <option value={15}>15 minutes</option>
                    <option value={30}>30 minutes</option>
                    <option value={45}>45 minutes</option>
                    <option value={60}>1 hour</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-[#667085] mb-1">After session</label>
                  <select
                    value={bufferAfter}
                    onChange={(e) => setBufferAfter(parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57]"
                  >
                    <option value={0}>No buffer</option>
                    <option value={5}>5 minutes</option>
                    <option value={10}>10 minutes</option>
                    <option value={15}>15 minutes</option>
                    <option value={30}>30 minutes</option>
                    <option value={45}>45 minutes</option>
                    <option value={60}>1 hour</option>
                  </select>
                </div>
              </div>

              {/* Visual Buffer Timeline */}
              <BufferTimeline
                duration={event.duration_minutes || 30}
                bufferBefore={bufferBefore}
                bufferAfter={bufferAfter}
              />

              <p className="text-xs text-[#667085] mt-3">
                Add breathing room before or after sessions. Times with conflicts in your calendar will be blocked.
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

            {/* Allow Any Time */}
            <div className="pt-4 border-t">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={ignoreBusyBlocks}
                  onChange={(e) => setIgnoreBusyBlocks(e.target.checked)}
                  className="mt-1 w-4 h-4 text-[#6F71EE] border-gray-300 rounded focus:ring-[#6F71EE]"
                />
                <div>
                  <span className="font-medium text-[#101E57]">Allow Any Time</span>
                  <p className="text-sm text-[#667085] mt-0.5">
                    Skip availability patterns and calendar conflict checks.
                    Bookings can be made any time from 6am-10pm. Useful for
                    internal booking links where you control who has access.
                  </p>
                </div>
              </label>
            </div>
          </div>
        </div>
        )}

        {/* Timezone Settings - Hide for round-robin since times are based on individual host availability */}
        {meetingType !== 'round_robin' && (
        <div
          id="timezone"
          ref={(el) => { sectionRefs.current['timezone'] = el; }}
          className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8"
        >
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
        )}

        {/* HubSpot Settings */}
        <div
          id="hubspot-settings"
          ref={(el) => { sectionRefs.current['hubspot-settings'] = el; }}
          className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8"
        >
          <h2 className="text-lg font-semibold text-[#101E57] mb-2">HubSpot Integration</h2>
          <p className="text-sm text-[#667085] mb-4">
            Configure how meetings from this event are logged to HubSpot.
          </p>

          {!hubspotConnected ? (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-amber-800">HubSpot not connected</p>
                  <p className="text-sm text-amber-700 mt-1">
                    Connect HubSpot in{' '}
                    <Link href="/admin/integrations" className="underline hover:no-underline">
                      Settings → Integrations
                    </Link>
                    {' '}to enable meeting type syncing.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#101E57] mb-2">
                  HubSpot Meeting Type
                </label>
                <select
                  value={hubspotMeetingType}
                  onChange={(e) => setHubspotMeetingType(e.target.value)}
                  className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57]"
                >
                  <option value="">No meeting type (default)</option>
                  {hubspotMeetingTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-[#667085] mt-1">
                  When bookings are logged to HubSpot, they&apos;ll be tagged with this meeting type.
                  This appears in HubSpot as the &quot;Call and meeting type&quot; field.
                </p>
              </div>

              {hubspotMeetingTypes.length === 0 && (
                <div className="bg-[#F6F6F9] rounded-lg p-3">
                  <p className="text-xs text-[#667085]">
                    <span className="font-medium text-[#101E57]">No meeting types found.</span>
                    {' '}Configure meeting types in HubSpot under Settings → Calling → Track Call and Meeting Types.
                  </p>
                </div>
              )}

              <div className="bg-[#6F71EE]/5 border border-[#6F71EE]/20 rounded-lg p-4 mt-4">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-[#6F71EE] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-[#101E57]">How it works</p>
                    <ul className="text-sm text-[#667085] mt-1 space-y-1">
                      <li>• When someone books this event, a meeting is created in HubSpot</li>
                      <li>• The meeting type you select here will be set on that HubSpot meeting</li>
                      <li>• Use different events to track different meeting types (e.g., First Demo vs. Follow-up)</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Slack Notifications */}
        <div
          id="slack-notifications"
          ref={(el) => { sectionRefs.current['slack-notifications'] = el; }}
          className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8"
        >
          <h2 className="text-lg font-semibold text-[#101E57] mb-2">Slack Notifications</h2>
          <p className="text-sm text-[#667085] mb-4">
            Get notified in Slack when new bookings are made for this event.
          </p>

          <div className="space-y-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={slackNotificationsEnabled}
                onChange={(e) => setSlackNotificationsEnabled(e.target.checked)}
                className="mt-1 w-4 h-4 text-[#6F71EE] border-gray-300 rounded focus:ring-[#6F71EE]"
              />
              <div>
                <span className="font-medium text-[#101E57]">Enable Slack Notifications</span>
                <p className="text-sm text-[#667085] mt-0.5">
                  When someone books this event, a notification will be sent to your configured Slack channel
                </p>
              </div>
            </label>

            {slackNotificationsEnabled && (
              <div className="ml-7 bg-[#6F71EE]/5 border border-[#6F71EE]/20 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-[#6F71EE] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-[#101E57]">What&apos;s included in notifications</p>
                    <ul className="text-sm text-[#667085] mt-1 space-y-1">
                      <li>• Attendee name and email</li>
                      <li>• First-time or returning status</li>
                      <li>• Date/time in the event&apos;s timezone</li>
                      <li>• Responses to custom questions</li>
                    </ul>
                    <p className="text-xs text-[#667085] mt-2">
                      Configure your Slack webhook in{' '}
                      <Link href="/admin/integrations" className="text-[#6F71EE] hover:underline">
                        Settings → Integrations
                      </Link>
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* SMS Reminders */}
        <div
          id="sms-reminders"
          ref={(el) => { sectionRefs.current['sms-reminders'] = el; }}
          className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8"
        >
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
                {/* Warning if no SMS provider configured */}
                {!smsProviderConnected && (
                  <SMSProviderWarning className="mb-2" />
                )}

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

                {/* 24-Hour Reminder with Preview */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-[#101E57] mb-1">
                      24-Hour Reminder Message
                    </label>
                    <textarea
                      value={smsReminder24hTemplate}
                      onChange={(e) => setSmsReminder24hTemplate(e.target.value)}
                      rows={3}
                      placeholder="Hi {{first_name}}, reminder: {{event_name}} tomorrow at {{time_with_timezone}}. Reply STOP to opt out."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57]"
                    />
                    <p className="text-xs text-[#667085] mt-1">
                      Leave empty to use the default template.
                    </p>
                  </div>
                  <SMSPreview
                    template={smsReminder24hTemplate || `Hi {{first_name}}, reminder: {{event_name}} tomorrow at {{time_with_timezone}}. Reply STOP to opt out.`}
                    eventId={id}
                  />
                </div>

                {/* 1-Hour Reminder with Preview */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-[#101E57] mb-1">
                      1-Hour Reminder Message
                    </label>
                    <textarea
                      value={smsReminder1hTemplate}
                      onChange={(e) => setSmsReminder1hTemplate(e.target.value)}
                      rows={3}
                      placeholder="Hi {{first_name}}, your {{event_name}} session starts in 1 hour at {{time_with_timezone}}."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57]"
                    />
                    <p className="text-xs text-[#667085] mt-1">
                      Leave empty to use the default template.
                    </p>
                  </div>
                  <SMSPreview
                    template={smsReminder1hTemplate || `Hi {{first_name}}, your {{event_name}} session starts in 1 hour at {{time_with_timezone}}.`}
                    eventId={id}
                  />
                </div>

                <div className="bg-[#F6F6F9] rounded-lg p-3">
                  <p className="text-xs font-medium text-[#101E57] mb-1">Available template variables:</p>
                  <p className="text-xs text-[#667085]">
                    {'{{first_name}}'}, {'{{last_name}}'}, {'{{event_name}}'}, {'{{time_with_timezone}}'}, {'{{date}}'}
                  </p>
                </div>

                {/* Test SMS Button */}
                <div className="flex items-center gap-4 pt-2">
                  <SMSTestButton
                    eventId={id}
                    templateType="24h"
                    disabled={!smsProviderConnected}
                  />
                  {!smsProviderConnected && (
                    <p className="text-xs text-[#667085]">
                      Connect an SMS provider to send test messages
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Phone Requirement (independent of SMS) */}
        <div
          id="phone-collection"
          ref={(el) => { sectionRefs.current['phone-collection'] = el; }}
          className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8"
        >
          <h2 className="text-lg font-semibold text-[#101E57] mb-2">Phone Number Collection</h2>
          <p className="text-sm text-[#667085] mb-4">
            Collect phone numbers from attendees for contact purposes. This is separate from SMS reminder settings.
          </p>

          <div className="space-y-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={phoneRequired}
                onChange={(e) => setPhoneRequired(e.target.checked)}
                className="mt-1 w-4 h-4 text-[#6F71EE] border-gray-300 rounded focus:ring-[#6F71EE]"
              />
              <div>
                <span className="font-medium text-[#101E57]">Require Phone Number</span>
                <p className="text-sm text-[#667085] mt-0.5">
                  Make phone number a required field on the booking form. Useful for reaching attendees if there are connection issues.
                </p>
              </div>
            </label>

            {phoneRequired && (
              <div className="ml-7 pt-2 bg-[#F6F6F9] rounded-lg p-4">
                <p className="text-sm text-[#667085]">
                  <strong className="text-[#101E57]">How it works:</strong> When enabled, attendees must provide a phone number to complete their booking.
                  If connected to HubSpot, the phone number will be auto-filled from their contact record when they enter their email.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Waitlist Settings - Show for group sessions and webinars only */}
        {/* Not applicable for one-on-one (single attendee) or round-robin (1:1 meetings assigned to different hosts) */}
        {meetingType !== 'one_on_one' && meetingType !== 'round_robin' && (
        <div
          id="waitlist"
          ref={(el) => { sectionRefs.current['waitlist'] = el; }}
          className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8"
        >
          <h2 className="text-lg font-semibold text-[#101E57] mb-2">Waitlist</h2>
          <p className="text-sm text-[#667085] mb-4">
            Allow attendees to join a waitlist when sessions are full. They&apos;ll be automatically promoted if someone cancels.
          </p>

          <div className="space-y-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={waitlistEnabled}
                onChange={(e) => setWaitlistEnabled(e.target.checked)}
                className="mt-1 w-4 h-4 text-[#6F71EE] border-gray-300 rounded focus:ring-[#6F71EE]"
              />
              <div>
                <span className="font-medium text-[#101E57]">Enable Waitlist</span>
                <p className="text-sm text-[#667085] mt-0.5">
                  When a session is full, allow attendees to join a waitlist
                </p>
              </div>
            </label>

            {waitlistEnabled && (
              <div className="ml-7 pt-2">
                <label className="block text-sm font-medium text-[#101E57] mb-2">
                  Maximum Waitlist Size
                </label>
                <input
                  type="number"
                  value={waitlistLimit}
                  onChange={(e) => setWaitlistLimit(e.target.value)}
                  placeholder="Unlimited"
                  min={1}
                  className="w-48 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57]"
                />
                <p className="text-xs text-[#667085] mt-1">
                  Leave empty for unlimited waitlist. Once the limit is reached, no more signups are allowed.
                </p>

                <div className="mt-4 bg-[#F6F6F9] rounded-lg p-4">
                  <h4 className="text-sm font-medium text-[#101E57] mb-2">How it works:</h4>
                  <ul className="text-sm text-[#667085] space-y-1">
                    <li>• When capacity is full, new signups go to the waitlist</li>
                    <li>• Waitlisted attendees receive a special email with their position</li>
                    <li>• When someone cancels, the first waitlisted person is auto-promoted</li>
                    <li>• Promoted attendees receive a confirmation email with meeting details</li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
        )}

        {/* Prep Materials - only for webinars */}
        {meetingType === 'webinar' && (
        <div
          id="prep-materials"
          ref={(el) => { sectionRefs.current['prep-materials'] = el; }}
          className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8"
        >
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
        )}

        {/* Task Templates - only for webinars */}
        {meetingType === 'webinar' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <TaskTemplatesManager eventId={id} />
        </div>
        )}

        {/* Prep Resources - only for webinars */}
        {meetingType === 'webinar' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <PrepResourcesManager eventId={id} />
        </div>
        )}

        {/* Spacer for sticky footer */}
        <div className="h-4"></div>
        </main>

        {/* Live Preview Panel */}
        <aside className="w-80 flex-shrink-0 hidden xl:block">
          <div className="sticky top-24">
            <BookingPagePreview
              eventName={eventName}
              eventDescription={eventDescription}
              hostName={event.host_name}
              duration={event.duration_minutes || 30}
              customQuestions={customQuestions}
              meetingType={meetingType}
              bannerImage={bannerMode === 'preset' ? bannerImage : bannerMode === 'custom' ? customBannerUrl : undefined}
            />
          </div>
        </aside>
      </div>

      {/* Sticky Footer Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-40">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-[#667085]">
            <span className="font-medium text-[#101E57]">{eventName || 'Untitled Event'}</span>
            <span>·</span>
            <span className="capitalize">{meetingType.replace('_', ' ')}</span>
          </div>
          <div className="flex items-center gap-3">
            {success && (
              <div className="flex items-center gap-2 bg-green-50 text-green-700 text-sm px-3 py-1.5 rounded-lg">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {success}
              </div>
            )}
            <Link
              href={`/admin/events/${id}`}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition text-[#667085] font-medium text-sm"
            >
              Cancel
            </Link>
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-[#6F71EE] text-white px-5 py-2 rounded-lg hover:bg-[#5a5cd0] transition disabled:opacity-50 font-medium text-sm"
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

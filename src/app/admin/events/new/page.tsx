'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import type { MeetingType, RoundRobinStrategy, RoundRobinPeriod, OHSessionTemplate } from '@/types';
import TimezoneSelector from '@/components/TimezoneSelector';
import { RichTextEditor } from '@/components/RichTextEditor';

interface TeamMember {
  id: string;
  name: string | null;
  email: string;
  google_connected?: boolean;
  availability_summary?: string;
  next_available_slots?: Array<{ start: string; display: string }>;
}

export default function NewEventPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Basic info
  const [formData, setFormData] = useState({
    name: '',
    subtitle: '',
    slug: '',
    description: '',
    duration_minutes: 30,
    host_name: '',
    host_email: '',
    buffer_before: 15,
    buffer_after: 15,
  });

  // Meeting type & capacity
  const [meetingType, setMeetingType] = useState<MeetingType>('group');
  const [maxAttendeesInput, setMaxAttendeesInput] = useState('30');

  // Booking rules
  const [minNoticeHours, setMinNoticeHours] = useState(24);
  const [bookingWindowDays, setBookingWindowDays] = useState(60);
  const [maxDailyBookings, setMaxDailyBookings] = useState<string>('');
  const [maxWeeklyBookings, setMaxWeeklyBookings] = useState<string>('');
  const [requireApproval, setRequireApproval] = useState(false);
  const [startTimeIncrement, setStartTimeIncrement] = useState(30);

  // Timezone
  const [displayTimezone, setDisplayTimezone] = useState('America/New_York');
  const [lockTimezone, setLockTimezone] = useState(false);

  // Round-robin settings
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [selectedHosts, setSelectedHosts] = useState<string[]>([]);
  const [roundRobinStrategy, setRoundRobinStrategy] = useState<RoundRobinStrategy>('priority');
  const [roundRobinPeriod, setRoundRobinPeriod] = useState<RoundRobinPeriod>('week');
  const [loadingTeam, setLoadingTeam] = useState(false);

  // Session templates
  const [templates, setTemplates] = useState<OHSessionTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  // Slug validation
  const [slugStatus, setSlugStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const [slugSuggestions, setSlugSuggestions] = useState<string[]>([]);
  const [existingEventName, setExistingEventName] = useState<string | null>(null);
  const [slugCopied, setSlugCopied] = useState(false);

  // Fetch current user profile and templates on mount
  useEffect(() => {
    fetchTemplates();
    fetchCurrentUser();
  }, []);

  const fetchCurrentUser = async () => {
    try {
      const response = await fetch('/api/admin/me');
      if (response.ok) {
        const user = await response.json();
        setFormData((prev) => ({
          ...prev,
          host_name: user.name || user.email.split('@')[0],
          host_email: user.email,
        }));
      }
    } catch (err) {
      console.error('Failed to fetch current user:', err);
    }
  };

  const fetchTemplates = async () => {
    try {
      const response = await fetch('/api/session-templates');
      if (response.ok) {
        const data = await response.json();
        setTemplates(data);
      }
    } catch (err) {
      console.error('Failed to fetch templates:', err);
    } finally {
      setLoadingTemplates(false);
    }
  };

  const applyTemplate = (template: OHSessionTemplate) => {
    setSelectedTemplate(template.id);
    setMeetingType(template.meeting_type as MeetingType);
    setFormData((prev) => ({
      ...prev,
      duration_minutes: template.duration_minutes,
    }));
    setMaxAttendeesInput(String(template.max_attendees));
    setMinNoticeHours(template.min_notice_hours);
    setBookingWindowDays(template.booking_window_days);
  };

  // Fetch team members when round-robin or collective is selected
  useEffect(() => {
    if ((meetingType === 'round_robin' || meetingType === 'collective') && teamMembers.length === 0) {
      fetchTeamMembers();
    }
  }, [meetingType]);

  // Check slug availability with debounce
  useEffect(() => {
    if (!formData.slug || formData.slug.length < 2) {
      setSlugStatus('idle');
      setSlugSuggestions([]);
      setExistingEventName(null);
      return;
    }

    setSlugStatus('checking');
    const timeoutId = setTimeout(async () => {
      try {
        const response = await fetch(`/api/events/check-slug?slug=${encodeURIComponent(formData.slug)}`);
        const data = await response.json();

        if (data.available) {
          setSlugStatus('available');
          setSlugSuggestions([]);
          setExistingEventName(null);
        } else {
          setSlugStatus('taken');
          setSlugSuggestions(data.suggestions || []);
          setExistingEventName(data.existingEventName || null);
        }
      } catch (err) {
        console.error('Failed to check slug:', err);
        setSlugStatus('idle');
      }
    }, 400); // 400ms debounce

    return () => clearTimeout(timeoutId);
  }, [formData.slug]);

  const fetchTeamMembers = async () => {
    setLoadingTeam(true);
    try {
      const response = await fetch('/api/admins?includeAvailability=true');
      if (response.ok) {
        const data = await response.json();
        setTeamMembers(data);
      }
    } catch (err) {
      console.error('Failed to fetch team members:', err);
    } finally {
      setLoadingTeam(false);
    }
  };

  const toggleHost = (adminId: string) => {
    setSelectedHosts((prev) =>
      prev.includes(adminId)
        ? prev.filter((id) => id !== adminId)
        : [...prev, adminId]
    );
  };

  const handleNameChange = (name: string) => {
    setFormData((prev) => ({
      ...prev,
      name,
      slug: name
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-'),
    }));
  };

  const handleMeetingTypeChange = (type: MeetingType) => {
    setMeetingType(type);
    // Auto-set max attendees based on type
    if (type === 'one_on_one' || type === 'round_robin' || type === 'collective') {
      setMaxAttendeesInput('1');
    } else if ((type === 'group' || type === 'webinar') && parseInt(maxAttendeesInput) === 1) {
      setMaxAttendeesInput('30');
    }
    // Set sensible defaults for group/webinar sessions (hosts create slots manually)
    if (type === 'group' || type === 'webinar') {
      setMinNoticeHours(0);
      setBookingWindowDays(365);
    } else {
      // Restore defaults for other types
      setMinNoticeHours(24);
      setBookingWindowDays(60);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Validate round-robin hosts
    if (meetingType === 'round_robin' && selectedHosts.length < 2) {
      setError('Please select at least 2 team members for round-robin distribution.');
      setLoading(false);
      return;
    }

    // Validate collective hosts
    if (meetingType === 'collective' && selectedHosts.length < 2) {
      setError('Please select at least 2 team members for collective meetings.');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          max_attendees: parseInt(maxAttendeesInput) || 2,
          meeting_type: meetingType,
          min_notice_hours: minNoticeHours,
          booking_window_days: bookingWindowDays,
          max_daily_bookings: maxDailyBookings ? parseInt(maxDailyBookings) : null,
          max_weekly_bookings: maxWeeklyBookings ? parseInt(maxWeeklyBookings) : null,
          require_approval: requireApproval,
          start_time_increment: startTimeIncrement,
          display_timezone: displayTimezone,
          lock_timezone: lockTimezone,
          // Round-robin settings
          round_robin_strategy: roundRobinStrategy,
          round_robin_period: roundRobinPeriod,
          round_robin_hosts: selectedHosts,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create event');
      }

      router.push(`/admin/events/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F6F6F9]">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-4">
          <Image
            src="https://info.whyliveschool.com/hubfs/Brand/liveschool-logo.png"
            alt="LiveSchool"
            width={120}
            height={32}
          />
          <Link href="/admin" className="text-[#6F71EE] hover:text-[#5a5cd0] font-medium">
            ← Back to Dashboard
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-semibold text-[#101E57] mb-2">Create New Event</h1>
        <p className="text-[#667085] mb-6">Set up a new booking event for your team.</p>

        {error && (
          <div className="bg-red-50 text-red-700 p-4 rounded-lg mb-6 text-sm">{error}</div>
        )}

        <form id="new-event-form" onSubmit={handleSubmit} className="space-y-8">
          {/* Quick Start: Templates - Compact horizontal scroll */}
          {!loadingTemplates && templates.length > 0 && (
            <div className="bg-gradient-to-r from-[#6F71EE]/5 to-[#417762]/5 rounded-lg border border-[#6F71EE]/20 p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🚀</span>
                  <h2 className="font-semibold text-[#101E57]">Quick Start</h2>
                </div>
                {selectedTemplate && (
                  <span className="text-xs text-[#417762] flex items-center gap-1 bg-[#417762]/10 px-2 py-1 rounded-full">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Template applied
                  </span>
                )}
              </div>
              <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-thin scrollbar-thumb-gray-300">
                {templates.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => applyTemplate(template)}
                    className={`flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-lg border-2 text-left transition whitespace-nowrap ${
                      selectedTemplate === template.id
                        ? 'border-[#6F71EE] bg-white shadow-sm'
                        : 'border-gray-200 bg-white hover:border-[#6F71EE]/50'
                    }`}
                  >
                    <span className="text-xl">{template.icon}</span>
                    <span className="font-medium text-[#101E57] text-sm">{template.name}</span>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setSelectedTemplate(null)}
                  className={`flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-lg border-2 text-left transition whitespace-nowrap ${
                    selectedTemplate === null
                      ? 'border-[#6F71EE] bg-white shadow-sm'
                      : 'border-gray-200 bg-white hover:border-[#6F71EE]/50'
                  }`}
                >
                  <span className="text-xl">✨</span>
                  <span className="font-medium text-[#101E57] text-sm">Start Fresh</span>
                </button>
              </div>
            </div>
          )}

          {/* Step 1: Meeting Type */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-6 h-6 bg-[#6F71EE] text-white rounded-full flex items-center justify-center text-sm font-medium">1</span>
              <h2 className="text-lg font-semibold text-[#101E57]">Meeting Type</h2>
            </div>
            <p className="text-sm text-[#667085] mb-4">
              Choose how attendees will be scheduled for this event.
            </p>

            <div className="grid gap-3">
              <label
                className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition ${
                  meetingType === 'one_on_one'
                    ? 'border-[#6F71EE] bg-[#6F71EE]/5'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="radio"
                  name="meeting_type"
                  value="one_on_one"
                  checked={meetingType === 'one_on_one'}
                  onChange={() => handleMeetingTypeChange('one_on_one')}
                  className="mt-1 w-4 h-4 text-[#6F71EE] border-gray-300 focus:ring-[#6F71EE]"
                />
                <div className="flex-1">
                  <span className="font-medium text-[#101E57]">One-on-One</span>
                  <p className="text-sm text-[#667085] mt-0.5">
                    Private meetings with one attendee at a time. Great for consultations, coaching, or support calls.
                  </p>
                </div>
              </label>

              <label
                className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition ${
                  meetingType === 'group'
                    ? 'border-[#6F71EE] bg-[#6F71EE]/5'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="radio"
                  name="meeting_type"
                  value="group"
                  checked={meetingType === 'group'}
                  onChange={() => handleMeetingTypeChange('group')}
                  className="mt-1 w-4 h-4 text-[#6F71EE] border-gray-300 focus:ring-[#6F71EE]"
                />
                <div className="flex-1">
                  <span className="font-medium text-[#101E57]">Group Session</span>
                  <p className="text-sm text-[#667085] mt-0.5">
                    Multiple attendees can join the same time slot. Perfect for webinars, group trainings, or Q&A sessions.
                  </p>
                </div>
              </label>

              <label
                className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition ${
                  meetingType === 'round_robin'
                    ? 'border-[#6F71EE] bg-[#6F71EE]/5'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="radio"
                  name="meeting_type"
                  value="round_robin"
                  checked={meetingType === 'round_robin'}
                  onChange={() => handleMeetingTypeChange('round_robin')}
                  className="mt-1 w-4 h-4 text-[#6F71EE] border-gray-300 focus:ring-[#6F71EE]"
                />
                <div className="flex-1">
                  <span className="font-medium text-[#101E57]">Round Robin</span>
                  <p className="text-sm text-[#667085] mt-0.5">
                    Automatically distribute bookings across team members. Great for support teams or sales calls.
                  </p>
                </div>
              </label>

              <label
                className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition ${
                  meetingType === 'collective'
                    ? 'border-[#6F71EE] bg-[#6F71EE]/5'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="radio"
                  name="meeting_type"
                  value="collective"
                  checked={meetingType === 'collective'}
                  onChange={() => handleMeetingTypeChange('collective')}
                  className="mt-1 w-4 h-4 text-[#6F71EE] border-gray-300 focus:ring-[#6F71EE]"
                />
                <div className="flex-1">
                  <span className="font-medium text-[#101E57]">Collective</span>
                  <p className="text-sm text-[#667085] mt-0.5">
                    All selected hosts must be available. Great for sales calls with AE + SDR, interviews, or support escalations.
                  </p>
                </div>
              </label>

              <label
                className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition ${
                  meetingType === 'webinar'
                    ? 'border-[#6F71EE] bg-[#6F71EE]/5'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="radio"
                  name="meeting_type"
                  value="webinar"
                  checked={meetingType === 'webinar'}
                  onChange={() => handleMeetingTypeChange('webinar')}
                  className="mt-1 w-4 h-4 text-[#6F71EE] border-gray-300 focus:ring-[#6F71EE]"
                />
                <div className="flex-1">
                  <span className="font-medium text-[#101E57]">Webinar</span>
                  <p className="text-sm text-[#667085] mt-0.5">
                    Scheduled sessions at specific times. You manually create time slots and attendees book those exact times.
                  </p>
                </div>
              </label>
            </div>

            {/* Team selection for round-robin and collective */}
            {(meetingType === 'round_robin' || meetingType === 'collective') && (
              <div className="mt-6 pt-6 border-t border-gray-200">
                <h3 className="font-medium text-[#101E57] mb-2">Select Team Members</h3>
                <p className="text-sm text-[#667085] mb-4">
                  {meetingType === 'round_robin'
                    ? 'Choose which team members will receive bookings. Select at least 2 people.'
                    : 'All selected members must be available for a time slot to appear. Select at least 2 people.'}
                </p>

                {loadingTeam ? (
                  <div className="animate-pulse space-y-2">
                    <div className="h-12 bg-gray-100 rounded-lg" />
                    <div className="h-12 bg-gray-100 rounded-lg" />
                  </div>
                ) : teamMembers.length === 0 ? (
                  <div className="text-center py-6 bg-gray-50 rounded-lg">
                    <p className="text-[#667085]">No team members found.</p>
                    <p className="text-sm text-[#667085] mt-1">
                      Team members need to log in first to appear here.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {teamMembers.map((member) => {
                      const hasConnectionIssue = member.google_connected === false;
                      const hasNoAvailability = member.availability_summary?.includes('No availability') || member.availability_summary?.includes('Unable');
                      const isHealthy = member.next_available_slots && member.next_available_slots.length > 0;

                      return (
                        <label
                          key={member.id}
                          className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition ${
                            selectedHosts.includes(member.id)
                              ? hasConnectionIssue
                                ? 'border-amber-400 bg-amber-50'
                                : 'border-[#6F71EE] bg-[#6F71EE]/5'
                              : hasConnectionIssue
                              ? 'border-amber-200 hover:border-amber-300'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selectedHosts.includes(member.id)}
                            onChange={() => toggleHost(member.id)}
                            className="mt-1 w-4 h-4 text-[#6F71EE] border-gray-300 rounded focus:ring-[#6F71EE]"
                          />
                          <div className="flex items-start gap-3 flex-1">
                            {/* Avatar with status indicator */}
                            <div className="relative flex-shrink-0">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                                hasConnectionIssue
                                  ? 'bg-amber-100 text-amber-700'
                                  : 'bg-[#6F71EE]/10 text-[#6F71EE]'
                              }`}>
                                {member.name?.charAt(0) || member.email.charAt(0).toUpperCase()}
                              </div>
                              {/* Status badge */}
                              {hasConnectionIssue && (
                                <div className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 rounded-full flex items-center justify-center">
                                  <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                  </svg>
                                </div>
                              )}
                              {isHealthy && !hasConnectionIssue && (
                                <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                                  <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                  </svg>
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-[#101E57]">
                                  {member.name || member.email.split('@')[0]}
                                </p>
                              </div>
                              <p className="text-sm text-[#667085]">{member.email}</p>
                              {/* Connection warning with action link */}
                              {hasConnectionIssue && (
                                <div className="mt-1.5 flex items-center gap-2">
                                  <span className="text-xs text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full font-medium">
                                    Calendar not connected
                                  </span>
                                  <Link
                                    href="/admin/settings"
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-xs text-[#6F71EE] hover:text-[#5a5cd0] underline"
                                  >
                                    Connect Calendar →
                                  </Link>
                                </div>
                              )}
                              {/* Availability status for connected users */}
                              {!hasConnectionIssue && member.availability_summary && (
                                <p className={`text-xs mt-1 flex items-center gap-1 ${
                                  hasNoAvailability ? 'text-[#667085]' : 'text-[#417762]'
                                }`}>
                                  {isHealthy ? (
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                  ) : (
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                  )}
                                  {member.availability_summary}
                                </p>
                              )}
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}

                {selectedHosts.length > 0 && (
                  <p className="text-sm text-[#6F71EE] mt-2">
                    {selectedHosts.length} team member{selectedHosts.length !== 1 ? 's' : ''} selected
                  </p>
                )}

                {/* Round-robin assignment logic - only show for round-robin */}
                {meetingType === 'round_robin' && (
                  <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                      <svg className="w-5 h-5 text-[#6F71EE]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      <h4 className="font-medium text-[#101E57]">Assignment Logic</h4>
                    </div>

                    {/* Coverage explanation */}
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm text-blue-800">
                        <strong>Maximum coverage:</strong> Attendees will see all time slots where <em>any</em> team member is available.
                        The strategy below only affects who gets assigned when someone books - not how many slots are shown.
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-[#101E57] mb-1">
                          Distribution Strategy
                        </label>
                        <select
                          value={roundRobinStrategy}
                          onChange={(e) => setRoundRobinStrategy(e.target.value as RoundRobinStrategy)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57] bg-white"
                        >
                          <option value="least_bookings">Load Balanced</option>
                          <option value="priority">Maximize Availability (Recommended)</option>
                          <option value="cycle">Simple Rotation</option>
                          <option value="availability_weighted">Availability Weighted</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-[#101E57] mb-1">
                          Balancing Period
                        </label>
                        <select
                          value={roundRobinPeriod}
                          onChange={(e) => setRoundRobinPeriod(e.target.value as RoundRobinPeriod)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57] bg-white disabled:bg-gray-100 disabled:text-gray-400"
                          disabled={roundRobinStrategy === 'cycle' || roundRobinStrategy === 'priority'}
                        >
                          <option value="day">Daily</option>
                          <option value="week">Weekly</option>
                          <option value="month">Monthly</option>
                          <option value="all_time">All Time</option>
                        </select>
                      </div>
                    </div>
                    <p className="text-sm text-[#667085]">
                      {roundRobinStrategy === 'cycle' && (
                        <>Rotate through hosts in a fixed order (A, B, C, A, B, C...). Simple and predictable, but can become unbalanced if hosts have different availability.</>
                      )}
                      {roundRobinStrategy === 'least_bookings' && (
                        <>Assign to whoever has the fewest bookings. Keeps workload balanced across the team - best choice if you just want fair distribution and maximum coverage.</>
                      )}
                      {roundRobinStrategy === 'availability_weighted' && (
                        <>Assign more bookings to hosts with more available hours. Use this if someone with a fuller calendar should take proportionally more meetings.</>
                      )}
                      {roundRobinStrategy === 'priority' && (
                        <>Shows all times when any host is free. The highest-priority available host gets the booking. If tied, the one with fewer recent meetings wins. Set priorities in event settings after creation.</>
                      )}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Step 2: Basic Info */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-6 h-6 bg-[#6F71EE] text-white rounded-full flex items-center justify-center text-sm font-medium">2</span>
              <h2 className="text-lg font-semibold text-[#101E57]">Event Details</h2>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-[#101E57] mb-1">
                  Event Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => handleNameChange(e.target.value)}
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
                  value={formData.subtitle}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, subtitle: e.target.value }))
                  }
                  placeholder="e.g., Open an Amazon.com Style Online Store for Your Students"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57]"
                />
                <p className="text-xs text-[#667085] mt-1">
                  Optional tagline shown below the event name on the booking page.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#101E57] mb-1">
                  URL Slug *
                </label>
                <div className="flex items-center">
                  <span className="text-[#667085] mr-1">/book/</span>
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      required
                      value={formData.slug}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, slug: e.target.value }))
                      }
                      placeholder="e.g., liveschool-store"
                      className={`w-full px-3 py-2 pr-10 border rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57] ${
                        slugStatus === 'taken'
                          ? 'border-red-400 bg-red-50'
                          : slugStatus === 'available'
                          ? 'border-green-400 bg-green-50'
                          : 'border-gray-300'
                      }`}
                    />
                    {/* Status indicator */}
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      {slugStatus === 'checking' && (
                        <svg className="w-5 h-5 text-gray-400 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                      )}
                      {slugStatus === 'available' && (
                        <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                      {slugStatus === 'taken' && (
                        <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      )}
                    </div>
                  </div>
                </div>
                {/* Slug taken warning and suggestions */}
                {slugStatus === 'taken' && (
                  <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-700">
                      This URL is already used by <strong>&quot;{existingEventName}&quot;</strong>
                    </p>
                    {slugSuggestions.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs text-red-600 mb-1">Try one of these instead:</p>
                        <div className="flex flex-wrap gap-2">
                          {slugSuggestions.map((suggestion) => (
                            <button
                              key={suggestion}
                              type="button"
                              onClick={() => setFormData((prev) => ({ ...prev, slug: suggestion }))}
                              className="px-2 py-1 text-xs bg-white border border-red-300 rounded hover:bg-red-100 text-red-700 transition"
                            >
                              {suggestion}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {slugStatus === 'available' && formData.slug.length >= 2 && (
                  <div className="mt-2 flex items-center justify-between p-2 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-sm text-green-700 font-mono">
                        liveschoolhelp.com/book/{formData.slug}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(`https://liveschoolhelp.com/book/${formData.slug}`);
                        setSlugCopied(true);
                        setTimeout(() => setSlugCopied(false), 2000);
                      }}
                      className="flex items-center gap-1 px-2 py-1 text-xs bg-white border border-green-300 rounded hover:bg-green-100 text-green-700 transition"
                    >
                      {slugCopied ? (
                        <>
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Copied!
                        </>
                      ) : (
                        <>
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          Copy Link
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-[#101E57] mb-1">
                  Description
                </label>
                <RichTextEditor
                  content={formData.description}
                  onChange={(html) =>
                    setFormData((prev) => ({ ...prev, description: html }))
                  }
                  placeholder="Describe what attendees will get from this session..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#101E57] mb-1">
                    Duration
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={5}
                      max={480}
                      value={formData.duration_minutes}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          duration_minutes: parseInt(e.target.value) || 30,
                        }))
                      }
                      className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57]"
                    />
                    <span className="text-sm text-[#667085]">minutes</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {[15, 25, 30, 45, 60, 90].map((mins) => (
                      <button
                        key={mins}
                        type="button"
                        onClick={() =>
                          setFormData((prev) => ({
                            ...prev,
                            duration_minutes: mins,
                          }))
                        }
                        className={`px-2 py-1 text-xs rounded ${
                          formData.duration_minutes === mins
                            ? 'bg-[#6F71EE] text-white'
                            : 'bg-gray-100 text-[#667085] hover:bg-gray-200'
                        }`}
                      >
                        {mins}m
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#101E57] mb-1">
                    Buffer Before
                  </label>
                  <select
                    value={formData.buffer_before}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        buffer_before: parseInt(e.target.value),
                      }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57]"
                  >
                    <option value={0}>No buffer</option>
                    <option value={5}>5 minutes</option>
                    <option value={10}>10 minutes</option>
                    <option value={15}>15 minutes</option>
                    <option value={30}>30 minutes</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#101E57] mb-1">
                    Buffer After
                  </label>
                  <select
                    value={formData.buffer_after}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        buffer_after: parseInt(e.target.value),
                      }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57]"
                  >
                    <option value={0}>No buffer</option>
                    <option value={5}>5 minutes</option>
                    <option value={10}>10 minutes</option>
                    <option value={15}>15 minutes</option>
                    <option value={30}>30 minutes</option>
                  </select>
                </div>
              </div>

              {meetingType === 'group' && (
                <div>
                  <label className="block text-sm font-medium text-[#101E57] mb-1">
                    Max Attendees per Session
                  </label>
                  <input
                    type="number"
                    min={2}
                    value={maxAttendeesInput}
                    onChange={(e) => setMaxAttendeesInput(e.target.value)}
                    onBlur={(e) => {
                      const val = parseInt(e.target.value);
                      if (isNaN(val) || val < 2) {
                        setMaxAttendeesInput('2');
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57]"
                  />
                  <p className="text-xs text-[#667085] mt-1">
                    How many people can join each time slot.
                  </p>
                </div>
              )}

              {/* Host name/email - hidden for round-robin and collective since host is assigned dynamically */}
              {(meetingType === 'round_robin' || meetingType === 'collective') ? (
                <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg flex items-start gap-2">
                  <svg className="w-5 h-5 text-[#667085] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm text-[#667085]">
                    <strong className="text-[#101E57]">Host is assigned automatically.</strong>{' '}
                    {meetingType === 'round_robin'
                      ? 'When someone books, the system assigns an available team member based on your distribution strategy. Their name and email will appear on calendar invites and confirmations.'
                      : 'All selected team members will be included on the meeting since everyone must be available.'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-[#101E57] mb-1">
                      Host Name
                    </label>
                    <input
                      type="text"
                      value={formData.host_name}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, host_name: e.target.value }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57]"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[#101E57] mb-1">
                      Host Email
                    </label>
                    <input
                      type="email"
                      value={formData.host_email}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, host_email: e.target.value }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57]"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Step 3: Booking Rules - Only shown for one_on_one and round_robin */}
          {(meetingType === 'one_on_one' || meetingType === 'round_robin') && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-2 mb-4">
                <span className="w-6 h-6 bg-[#6F71EE] text-white rounded-full flex items-center justify-center text-sm font-medium">3</span>
                <h2 className="text-lg font-semibold text-[#101E57]">Booking Rules</h2>
              </div>
              <p className="text-sm text-[#667085] mb-4">
                Control when and how attendees can book sessions.
              </p>

              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-[#101E57] mb-1">
                      Minimum Notice
                    </label>
                    <select
                      value={minNoticeHours}
                      onChange={(e) => setMinNoticeHours(parseInt(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57]"
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
                    <p className="text-xs text-[#667085] mt-1">
                      How far in advance attendees must book.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[#101E57] mb-1">
                      Booking Window
                    </label>
                    <select
                      value={bookingWindowDays}
                      onChange={(e) => setBookingWindowDays(parseInt(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57]"
                    >
                      <option value={7}>1 week ahead</option>
                      <option value={14}>2 weeks ahead</option>
                      <option value={30}>30 days ahead</option>
                      <option value={60}>60 days ahead</option>
                      <option value={90}>90 days ahead</option>
                      <option value={180}>6 months ahead</option>
                      <option value={365}>1 year ahead</option>
                    </select>
                    <p className="text-xs text-[#667085] mt-1">
                      How far into the future attendees can book.
                    </p>
                  </div>
                </div>

                {/* Start Time Increments */}
                <div>
                  <label className="block text-sm font-medium text-[#101E57] mb-1">
                    Start Time Increments
                  </label>
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
                  <p className="text-xs text-[#667085] mt-1">
                    How often time slots appear (e.g., 30-min = 9:00, 9:30, 10:00).
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-[#101E57] mb-1">
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
                    <label className="block text-sm font-medium text-[#101E57] mb-1">
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
                  Leave empty for unlimited. Limits are for this event, not per attendee.
                </p>

                <label className="flex items-start gap-3 cursor-pointer pt-4 border-t">
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
                    </p>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* Timezone - Hidden for round-robin/collective since hosts have different timezones */}
          {(meetingType === 'round_robin' || meetingType === 'collective') ? (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-2 mb-4">
                <span className="w-6 h-6 bg-[#6F71EE] text-white rounded-full flex items-center justify-center text-sm font-medium">4</span>
                <h2 className="text-lg font-semibold text-[#101E57]">Timezone</h2>
              </div>
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg flex items-start gap-2">
                <svg className="w-5 h-5 text-[#667085] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="text-sm text-[#101E57] font-medium">Automatic timezone handling</p>
                  <p className="text-sm text-[#667085] mt-1">
                    Since your team members may be in different timezones, times are automatically shown to attendees in their detected timezone.
                    Each host&apos;s availability is calculated in their own timezone.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-2 mb-4">
                <span className="w-6 h-6 bg-[#6F71EE] text-white rounded-full flex items-center justify-center text-sm font-medium">
                  {meetingType === 'group' ? '3' : '4'}
                </span>
                <h2 className="text-lg font-semibold text-[#101E57]">Timezone</h2>
              </div>

              <div className="flex items-center gap-4">
                <TimezoneSelector
                  value={displayTimezone}
                  onChange={setDisplayTimezone}
                  className="flex-1 max-w-sm"
                />
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    checked={lockTimezone}
                    onChange={(e) => setLockTimezone(e.target.checked)}
                    className="w-4 h-4 text-[#6F71EE] border-gray-300 rounded focus:ring-[#6F71EE]"
                  />
                  <span className="text-[#667085]">Lock timezone</span>
                </label>
              </div>
              <p className="text-xs text-[#667085] mt-2">
                Times will be shown in this timezone. {lockTimezone ? 'Attendee timezone detection is disabled.' : 'Attendees can view in their own timezone.'}
              </p>
            </div>
          )}

          {/* Spacer for sticky footer */}
          <div className="h-24" />
        </form>
      </main>

      {/* Sticky Footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-[#667085]">
            {formData.name ? (
              <>
                <span className="font-medium text-[#101E57]">{formData.name}</span>
                {slugStatus === 'available' && (
                  <span className="text-green-600 flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Ready
                  </span>
                )}
                {slugStatus === 'taken' && (
                  <span className="text-red-600 flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    Fix URL
                  </span>
                )}
              </>
            ) : (
              <span className="italic">Enter event name to continue</span>
            )}
          </div>
          <div className="flex gap-3">
            <Link
              href="/admin"
              className="px-5 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition text-[#667085] font-medium"
            >
              Cancel
            </Link>
            <button
              type="submit"
              form="new-event-form"
              disabled={loading || slugStatus === 'taken' || slugStatus === 'checking' || !formData.name}
              className="bg-[#6F71EE] text-white px-5 py-2.5 rounded-lg hover:bg-[#5a5cd0] transition disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Creating...
                </>
              ) : (
                'Create Event'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

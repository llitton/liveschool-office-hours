'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import type { MeetingType, RoundRobinStrategy, RoundRobinPeriod } from '@/types';
import TimezoneSelector from '@/components/TimezoneSelector';

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
    slug: '',
    description: '',
    duration_minutes: 30,
    host_name: 'Hannah Kelly',
    host_email: 'hannah@liveschoolinc.com',
    buffer_minutes: 15,
  });

  // Meeting type & capacity
  const [meetingType, setMeetingType] = useState<MeetingType>('group');
  const [maxAttendees, setMaxAttendees] = useState(30);

  // Booking rules
  const [minNoticeHours, setMinNoticeHours] = useState(24);
  const [bookingWindowDays, setBookingWindowDays] = useState(60);
  const [maxDailyBookings, setMaxDailyBookings] = useState<string>('');
  const [maxWeeklyBookings, setMaxWeeklyBookings] = useState<string>('');
  const [requireApproval, setRequireApproval] = useState(false);

  // Timezone
  const [displayTimezone, setDisplayTimezone] = useState('America/New_York');
  const [lockTimezone, setLockTimezone] = useState(false);

  // Round-robin settings
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [selectedHosts, setSelectedHosts] = useState<string[]>([]);
  const [roundRobinStrategy, setRoundRobinStrategy] = useState<RoundRobinStrategy>('cycle');
  const [roundRobinPeriod, setRoundRobinPeriod] = useState<RoundRobinPeriod>('week');
  const [loadingTeam, setLoadingTeam] = useState(false);

  // Fetch team members when round-robin is selected
  useEffect(() => {
    if (meetingType === 'round_robin' && teamMembers.length === 0) {
      fetchTeamMembers();
    }
  }, [meetingType]);

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
    if (type === 'one_on_one' || type === 'round_robin') {
      setMaxAttendees(1);
    } else if (type === 'group' && maxAttendees === 1) {
      setMaxAttendees(30);
    }
    // Set sensible defaults for group sessions (hosts create slots manually)
    if (type === 'group') {
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

    try {
      const response = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          max_attendees: maxAttendees,
          meeting_type: meetingType,
          min_notice_hours: minNoticeHours,
          booking_window_days: bookingWindowDays,
          max_daily_bookings: maxDailyBookings ? parseInt(maxDailyBookings) : null,
          max_weekly_bookings: maxWeeklyBookings ? parseInt(maxWeeklyBookings) : null,
          require_approval: requireApproval,
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

        <form onSubmit={handleSubmit} className="space-y-8">
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
            </div>

            <p className="text-xs text-[#667085] mt-3">
              More meeting types (collective, panel) coming soon.
            </p>

            {/* Round-robin team selection */}
            {meetingType === 'round_robin' && (
              <div className="mt-6 pt-6 border-t border-gray-200">
                <h3 className="font-medium text-[#101E57] mb-2">Select Team Members</h3>
                <p className="text-sm text-[#667085] mb-4">
                  Choose which team members will receive bookings. Select at least 2 people.
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
                    {teamMembers.map((member) => (
                      <label
                        key={member.id}
                        className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition ${
                          selectedHosts.includes(member.id)
                            ? 'border-[#6F71EE] bg-[#6F71EE]/5'
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
                          <div className="w-8 h-8 rounded-full bg-[#6F71EE]/10 text-[#6F71EE] flex items-center justify-center text-sm font-medium flex-shrink-0">
                            {member.name?.charAt(0) || member.email.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-[#101E57]">
                              {member.name || member.email.split('@')[0]}
                            </p>
                            <p className="text-sm text-[#667085]">{member.email}</p>
                            {member.availability_summary && (
                              <p className={`text-xs mt-1 ${
                                member.google_connected === false
                                  ? 'text-amber-600'
                                  : member.availability_summary.includes('No availability') || member.availability_summary.includes('Unable')
                                  ? 'text-[#667085]'
                                  : 'text-[#417762]'
                              }`}>
                                {member.google_connected === false ? (
                                  <svg className="w-3 h-3 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                  </svg>
                                ) : member.next_available_slots && member.next_available_slots.length > 0 ? (
                                  <svg className="w-3 h-3 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                ) : (
                                  <svg className="w-3 h-3 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                )}
                                {member.availability_summary}
                              </p>
                            )}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                )}

                {selectedHosts.length > 0 && (
                  <p className="text-sm text-[#6F71EE] mt-2">
                    {selectedHosts.length} team member{selectedHosts.length !== 1 ? 's' : ''} selected
                  </p>
                )}

                {/* Round-robin strategy */}
                <div className="mt-6 grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-[#101E57] mb-1">
                      Distribution Strategy
                    </label>
                    <select
                      value={roundRobinStrategy}
                      onChange={(e) => setRoundRobinStrategy(e.target.value as RoundRobinStrategy)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57]"
                    >
                      <option value="cycle">Simple Rotation</option>
                      <option value="least_bookings">Load Balanced</option>
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57]"
                    >
                      <option value="day">Daily</option>
                      <option value="week">Weekly</option>
                      <option value="month">Monthly</option>
                      <option value="all_time">All Time</option>
                    </select>
                  </div>
                </div>
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
                  placeholder="e.g., LiveSchool Store Setup Help"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#101E57] mb-1">
                  URL Slug *
                </label>
                <div className="flex items-center">
                  <span className="text-[#667085] mr-1">/book/</span>
                  <input
                    type="text"
                    required
                    value={formData.slug}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, slug: e.target.value }))
                    }
                    placeholder="e.g., liveschool-store"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#101E57] mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, description: e.target.value }))
                  }
                  rows={3}
                  placeholder="Describe what attendees will get from this session..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#101E57] mb-1">
                    Duration
                  </label>
                  <select
                    value={formData.duration_minutes}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        duration_minutes: parseInt(e.target.value),
                      }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57]"
                  >
                    <option value={15}>15 minutes</option>
                    <option value={30}>30 minutes</option>
                    <option value={45}>45 minutes</option>
                    <option value={60}>60 minutes</option>
                    <option value={90}>90 minutes</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#101E57] mb-1">
                    Buffer After
                  </label>
                  <select
                    value={formData.buffer_minutes}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        buffer_minutes: parseInt(e.target.value),
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
                    value={maxAttendees}
                    onChange={(e) => setMaxAttendees(parseInt(e.target.value) || 2)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57]"
                  />
                  <p className="text-xs text-[#667085] mt-1">
                    How many people can join each time slot.
                  </p>
                </div>
              )}

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

          {/* Timezone - Simplified inline for group, or Step 3/4 for others */}
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

          {/* Submit */}
          <div className="flex gap-4">
            <button
              type="submit"
              disabled={loading}
              className="bg-[#6F71EE] text-white px-6 py-3 rounded-lg hover:bg-[#5a5cd0] transition disabled:opacity-50 font-medium"
            >
              {loading ? 'Creating...' : 'Create Event'}
            </button>
            <Link
              href="/admin"
              className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition text-[#667085] font-medium"
            >
              Cancel
            </Link>
          </div>
        </form>
      </main>
    </div>
  );
}

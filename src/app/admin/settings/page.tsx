'use client';

import { useState, useEffect } from 'react';
import { PageContainer, PageHeader } from '@/components/AppShell';
import type { OHAvailabilityPattern } from '@/types';

interface PatternInput {
  day_of_week: number;
  start_time: string;
  end_time: string;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface AdminProfile {
  name: string | null;
  email: string;
  profile_image: string | null;
}

// Common US timezones for the dropdown
const TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Phoenix', label: 'Arizona (MST)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HST)' },
];

export default function SettingsPage() {
  const [patterns, setPatterns] = useState<OHAvailabilityPattern[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<{
    googleConnected: boolean;
    lastSynced: string | null;
    busyBlocksCount: number;
  } | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Profile state
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Editable patterns state
  const [editPatterns, setEditPatterns] = useState<PatternInput[]>([]);
  const [showInactiveDays, setShowInactiveDays] = useState(false);

  // Timezone state - detect from browser initially
  const [timezone, setTimezone] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      // Check if browser timezone is in our list, otherwise default to Eastern
      return TIMEZONES.some(tz => tz.value === browserTz) ? browserTz : 'America/New_York';
    }
    return 'America/New_York';
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [patternsRes, syncRes, profileRes] = await Promise.all([
        fetch('/api/availability/patterns'),
        fetch('/api/availability/sync'),
        fetch('/api/admin/me'),
      ]);

      if (patternsRes.ok) {
        const data = await patternsRes.json();
        setPatterns(data);
        setEditPatterns(
          data.map((p: OHAvailabilityPattern) => ({
            day_of_week: p.day_of_week,
            start_time: p.start_time.slice(0, 5), // Convert HH:mm:ss to HH:mm
            end_time: p.end_time.slice(0, 5),
          }))
        );
        // Load saved timezone from first pattern (all patterns share same timezone)
        if (data.length > 0 && data[0].timezone) {
          setTimezone(data[0].timezone);
        }
      }

      if (syncRes.ok) {
        const syncData = await syncRes.json();
        setSyncStatus(syncData);
      }

      if (profileRes.ok) {
        const profileData = await profileRes.json();
        setProfile(profileData);
      }
    } catch (err) {
      setError('Failed to load availability data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type client-side
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      setError('Please upload a JPEG, PNG, WebP, or GIF image.');
      return;
    }

    // Validate file size client-side (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('File too large. Maximum size is 5MB.');
      return;
    }

    setUploadingImage(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/admin/profile-image', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to upload image');
      }

      const data = await response.json();
      setProfile((prev) => (prev ? { ...prev, profile_image: data.url } : prev));
      setSuccess('Profile photo updated!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload image');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleRemoveImage = async () => {
    setUploadingImage(true);
    setError('');

    try {
      const response = await fetch('/api/admin/profile-image', {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to remove image');
      }

      setProfile((prev) => (prev ? { ...prev, profile_image: null } : prev));
      setSuccess('Profile photo removed');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('Failed to remove image');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSavePatterns = async () => {
    setSaving(true);
    setError('');
    setSuccess('');

    // Validate patterns
    for (const pattern of editPatterns) {
      if (pattern.start_time >= pattern.end_time) {
        setError(`Invalid time range for ${DAY_NAMES[pattern.day_of_week]}: start must be before end`);
        setSaving(false);
        return;
      }
    }

    try {
      const response = await fetch('/api/availability/patterns', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patterns: editPatterns, timezone }),
      });

      if (!response.ok) {
        throw new Error('Failed to save patterns');
      }

      const data = await response.json();
      setPatterns(data);
      setSuccess('Availability saved successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('Failed to save availability');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleSyncCalendar = async () => {
    setSyncing(true);
    setError('');

    try {
      const response = await fetch('/api/availability/sync', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to sync calendar');
      }

      const data = await response.json();
      setSyncStatus({
        googleConnected: true,
        lastSynced: new Date().toISOString(),
        busyBlocksCount: data.busyBlocksCount,
      });
      setSuccess('Calendar synced successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('Failed to sync with Google Calendar');
      console.error(err);
    } finally {
      setSyncing(false);
    }
  };

  const addPattern = (dayOfWeek: number) => {
    // Check if pattern for this day already exists
    const existing = editPatterns.find((p) => p.day_of_week === dayOfWeek);
    if (existing) {
      setError(`You already have availability set for ${DAY_NAMES[dayOfWeek]}`);
      return;
    }

    setEditPatterns([
      ...editPatterns,
      { day_of_week: dayOfWeek, start_time: '09:00', end_time: '17:00' },
    ].sort((a, b) => a.day_of_week - b.day_of_week));
  };

  const updatePattern = (dayOfWeek: number, field: 'start_time' | 'end_time', value: string) => {
    setEditPatterns(
      editPatterns.map((p) =>
        p.day_of_week === dayOfWeek ? { ...p, [field]: value } : p
      )
    );
  };

  const removePattern = (dayOfWeek: number) => {
    setEditPatterns(editPatterns.filter((p) => p.day_of_week !== dayOfWeek));
  };

  if (loading) {
    return (
      <PageContainer narrow>
        <PageHeader
          title="My Settings"
          description="Set up your profile, timezone, and availability"
        />
        <div className="bg-white rounded-xl p-6 animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-48 mb-4" />
          <div className="h-32 bg-gray-100 rounded" />
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer narrow>
      <PageHeader
        title="My Settings"
        description="Set up your profile, timezone, and availability"
      />

        {error && (
          <div className="bg-red-50 text-red-700 p-4 rounded-lg mb-6 text-sm">{error}</div>
        )}

        {success && (
          <div className="bg-green-50 text-green-700 p-4 rounded-lg mb-6 text-sm">{success}</div>
        )}

        {/* Google Calendar Sync */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-[#101E57]">Google Calendar Sync</h2>
              <p className="text-sm text-[#667085] mt-1">
                Automatically block times from your Google Calendar
              </p>
            </div>
            {syncStatus?.googleConnected ? (
              <button
                onClick={handleSyncCalendar}
                disabled={syncing}
                className="bg-[#6F71EE] text-white px-4 py-2 rounded-lg hover:bg-[#5a5cd0] transition disabled:opacity-50 font-medium"
              >
                {syncing ? 'Syncing...' : 'Sync Now'}
              </button>
            ) : (
              <a
                href="/api/auth/login"
                className="bg-[#6F71EE] text-white px-4 py-2 rounded-lg hover:bg-[#5a5cd0] transition font-medium"
              >
                Connect Google Calendar
              </a>
            )}
          </div>

          {syncStatus && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="flex items-center gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${syncStatus.googleConnected ? 'bg-green-500' : 'bg-gray-300'}`} />
                  <span className="text-[#667085]">
                    {syncStatus.googleConnected ? 'Connected' : 'Not connected'}
                  </span>
                </div>
                {syncStatus.lastSynced && (
                  <span className="text-[#667085]">
                    Last synced: {new Date(syncStatus.lastSynced).toLocaleString()}
                  </span>
                )}
                {syncStatus.busyBlocksCount > 0 && (
                  <span className="text-[#667085]">
                    {syncStatus.busyBlocksCount} busy blocks cached
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Profile Photo Section */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold text-[#101E57]">Profile Photo</h2>
              <p className="text-sm text-[#667085] mt-1">
                This photo appears on your booking pages so attendees know who they&apos;re meeting with
              </p>
            </div>
          </div>
          <div className="flex items-center gap-6 mt-4">
            {/* Photo preview */}
            <div className="relative">
              {profile?.profile_image ? (
                <img
                  src={profile.profile_image}
                  alt="Profile"
                  className="w-24 h-24 rounded-full object-cover border-2 border-gray-200"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-[#6F71EE] flex items-center justify-center text-white text-2xl font-medium">
                  {profile?.name?.[0]?.toUpperCase() || profile?.email?.[0]?.toUpperCase() || '?'}
                </div>
              )}
              {uploadingImage && (
                <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                  <svg className="animate-spin h-6 w-6 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </div>
              )}
            </div>

            {/* Upload controls */}
            <div className="flex flex-col gap-2">
              <label className="cursor-pointer">
                <span className="inline-block bg-[#6F71EE] text-white px-4 py-2 rounded-lg hover:bg-[#5a5cd0] transition font-medium text-sm">
                  {profile?.profile_image ? 'Change Photo' : 'Upload Photo'}
                </span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={handleImageUpload}
                  disabled={uploadingImage}
                  className="hidden"
                />
              </label>
              {profile?.profile_image && (
                <button
                  onClick={handleRemoveImage}
                  disabled={uploadingImage}
                  className="text-red-600 hover:text-red-700 text-sm font-medium"
                >
                  Remove photo
                </button>
              )}
              <p className="text-xs text-[#667085] mt-1">
                JPEG, PNG, WebP, or GIF. Max 5MB.
              </p>
            </div>
          </div>
        </div>

        {/* Timezone Section - Always important */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold text-[#101E57]">Your Timezone</h2>
              <p className="text-sm text-[#667085] mt-1">
                This ensures your calendar and session times display correctly
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 mt-4 p-3 bg-[#F6F6F9] rounded-lg">
            <svg className="w-5 h-5 text-[#667085]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="flex-1 max-w-xs px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57]"
            >
              {TIMEZONES.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
            </select>
            <button
              onClick={handleSavePatterns}
              disabled={saving}
              className="bg-[#6F71EE] text-white px-4 py-2 rounded-lg hover:bg-[#5a5cd0] transition disabled:opacity-50 font-medium text-sm"
            >
              {saving ? 'Saving...' : 'Save Timezone'}
            </button>
          </div>
        </div>

        {/* Weekly Availability Patterns */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-[#101E57]">Weekly Availability</h2>
              <p className="text-sm text-[#667085] mt-1">
                Optional: Set your regular hours for round-robin events and co-hosting
              </p>
            </div>
            {editPatterns.length > 0 && (
              <div className="text-right">
                <p className="text-sm font-medium text-[#417762]">
                  {editPatterns.length} day{editPatterns.length !== 1 ? 's' : ''} configured
                </p>
                <p className="text-xs text-[#667085]">
                  {editPatterns.reduce((total, p) => {
                    const start = parseInt(p.start_time.split(':')[0]) + parseInt(p.start_time.split(':')[1]) / 60;
                    const end = parseInt(p.end_time.split(':')[0]) + parseInt(p.end_time.split(':')[1]) / 60;
                    return total + (end - start);
                  }, 0).toFixed(1)} hours/week
                </p>
              </div>
            )}
          </div>

          <div className="space-y-3">
            {/* Active days - always shown */}
            {editPatterns.length > 0 ? (
              editPatterns
                .sort((a, b) => a.day_of_week - b.day_of_week)
                .map((pattern) => (
                  <div
                    key={pattern.day_of_week}
                    className="flex items-center gap-4 p-4 rounded-lg bg-[#6F71EE]/5 border border-[#6F71EE]/20"
                  >
                    <div className="w-28">
                      <span className="font-medium text-[#101E57]">
                        {DAY_NAMES[pattern.day_of_week]}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-1">
                      <input
                        type="time"
                        value={pattern.start_time}
                        onChange={(e) => updatePattern(pattern.day_of_week, 'start_time', e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57]"
                      />
                      <span className="text-[#667085]">to</span>
                      <input
                        type="time"
                        value={pattern.end_time}
                        onChange={(e) => updatePattern(pattern.day_of_week, 'end_time', e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57]"
                      />
                      <span className="text-xs text-[#667085] ml-2">
                        {(() => {
                          const start = parseInt(pattern.start_time.split(':')[0]) + parseInt(pattern.start_time.split(':')[1]) / 60;
                          const end = parseInt(pattern.end_time.split(':')[0]) + parseInt(pattern.end_time.split(':')[1]) / 60;
                          const hours = end - start;
                          return hours > 0 ? `${hours}h` : '';
                        })()}
                      </span>
                    </div>
                    <button
                      onClick={() => removePattern(pattern.day_of_week)}
                      className="text-red-600 hover:text-red-700 text-sm font-medium"
                    >
                      Remove
                    </button>
                  </div>
                ))
            ) : (
              <div className="text-center py-8 text-[#667085]">
                <p className="mb-2">No days configured yet</p>
                <p className="text-sm">Click below to add availability for specific days</p>
              </div>
            )}

            {/* Inactive days - collapsed by default */}
            {(() => {
              const activeDays = editPatterns.map(p => p.day_of_week);
              const inactiveDays = [0, 1, 2, 3, 4, 5, 6].filter(d => !activeDays.includes(d));

              if (inactiveDays.length === 0) return null;

              return (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  {!showInactiveDays ? (
                    <button
                      onClick={() => setShowInactiveDays(true)}
                      className="flex items-center gap-2 text-[#6F71EE] hover:text-[#5a5cd0] text-sm font-medium"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Add availability to {inactiveDays.length === 7 ? 'a day' : `${inactiveDays.length} more day${inactiveDays.length !== 1 ? 's' : ''}`}
                      <span className="text-[#667085] font-normal">
                        ({inactiveDays.map(d => DAY_SHORT[d]).join(', ')})
                      </span>
                    </button>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-[#667085]">Add availability:</span>
                        <button
                          onClick={() => setShowInactiveDays(false)}
                          className="text-xs text-[#667085] hover:text-[#101E57]"
                        >
                          Hide
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {inactiveDays.map((dayIndex) => (
                          <button
                            key={dayIndex}
                            onClick={() => {
                              addPattern(dayIndex);
                              if (inactiveDays.length === 1) setShowInactiveDays(false);
                            }}
                            className="px-4 py-2 bg-[#F6F6F9] hover:bg-[#6F71EE]/10 rounded-lg text-sm text-[#667085] hover:text-[#6F71EE] transition"
                          >
                            + {DAY_NAMES[dayIndex]}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          <div className="mt-6 pt-6 border-t border-gray-100 flex gap-4">
            <button
              onClick={handleSavePatterns}
              disabled={saving}
              className="bg-[#6F71EE] text-white px-6 py-2 rounded-lg hover:bg-[#5a5cd0] transition disabled:opacity-50 font-medium"
            >
              {saving ? 'Saving...' : 'Save Availability'}
            </button>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-[#101E57] mb-4">Quick Presets</h2>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => {
                setEditPatterns([
                  { day_of_week: 1, start_time: '09:00', end_time: '17:00' },
                  { day_of_week: 2, start_time: '09:00', end_time: '17:00' },
                  { day_of_week: 3, start_time: '09:00', end_time: '17:00' },
                  { day_of_week: 4, start_time: '09:00', end_time: '17:00' },
                  { day_of_week: 5, start_time: '09:00', end_time: '17:00' },
                ]);
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition text-sm text-[#667085]"
            >
              Weekdays 9am-5pm
            </button>
            <button
              onClick={() => {
                setEditPatterns([
                  { day_of_week: 2, start_time: '14:00', end_time: '16:00' },
                  { day_of_week: 4, start_time: '14:00', end_time: '16:00' },
                ]);
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition text-sm text-[#667085]"
            >
              Tue/Thu 2-4pm
            </button>
            <button
              onClick={() => {
                setEditPatterns([
                  { day_of_week: 3, start_time: '10:00', end_time: '12:00' },
                ]);
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition text-sm text-[#667085]"
            >
              Wednesday mornings
            </button>
            <button
              onClick={() => setEditPatterns([])}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition text-sm text-red-600"
            >
              Clear all
            </button>
          </div>
        </div>
    </PageContainer>
  );
}

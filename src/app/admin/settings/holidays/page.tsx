'use client';

import { useState, useEffect } from 'react';
import { PageContainer, PageHeader } from '@/components/AppShell';
import type { OHCompanyHoliday } from '@/types';

export default function HolidaysPage() {
  const [holidays, setHolidays] = useState<OHCompanyHoliday[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // New holiday form state
  const [newDate, setNewDate] = useState('');
  const [newName, setNewName] = useState('');

  useEffect(() => {
    fetchHolidays();
  }, []);

  const fetchHolidays = async () => {
    try {
      const response = await fetch('/api/company-holidays');
      if (response.ok) {
        const data = await response.json();
        setHolidays(data);
      }
    } catch (err) {
      setError('Failed to load holidays');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDate || !newName.trim()) {
      setError('Please provide both a date and name for the holiday');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/company-holidays', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: newDate, name: newName.trim() }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to add holiday');
      }

      const newHoliday = await response.json();
      setHolidays([...holidays, newHoliday].sort((a, b) => a.date.localeCompare(b.date)));
      setNewDate('');
      setNewName('');
      setSuccess('Holiday added successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add holiday');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteHoliday = async (holidayId: string) => {
    if (!confirm('Are you sure you want to remove this holiday?')) {
      return;
    }

    setError('');
    setSuccess('');

    try {
      const response = await fetch(`/api/company-holidays?id=${holidayId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to remove holiday');
      }

      setHolidays(holidays.filter((h) => h.id !== holidayId));
      setSuccess('Holiday removed successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('Failed to remove holiday');
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const isPastDate = (dateStr: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const date = new Date(dateStr + 'T00:00:00');
    return date < today;
  };

  // Separate past and upcoming holidays
  const upcomingHolidays = holidays.filter((h) => !isPastDate(h.date));
  const pastHolidays = holidays.filter((h) => isPastDate(h.date));

  if (loading) {
    return (
      <PageContainer narrow>
        <PageHeader
          title="Company Holidays"
          description="Manage company-wide holidays that block all employee availability"
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
        title="Company Holidays"
        description="Manage company-wide holidays that block all employee availability"
      />

      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-lg mb-6 text-sm">{error}</div>
      )}

      {success && (
        <div className="bg-green-50 text-green-700 p-4 rounded-lg mb-6 text-sm">{success}</div>
      )}

      {/* Add New Holiday Form */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-[#101E57] mb-4">Add Holiday</h2>
        <form onSubmit={handleAddHoliday} className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <label htmlFor="holiday-date" className="block text-sm font-medium text-[#667085] mb-1">
              Date
            </label>
            <input
              id="holiday-date"
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57]"
              required
            />
          </div>
          <div className="flex-[2]">
            <label htmlFor="holiday-name" className="block text-sm font-medium text-[#667085] mb-1">
              Holiday Name
            </label>
            <input
              id="holiday-name"
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g., Christmas Day"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57]"
              required
            />
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={saving}
              className="bg-[#6F71EE] text-white px-6 py-2 rounded-lg hover:bg-[#5a5cd0] transition disabled:opacity-50 font-medium whitespace-nowrap"
            >
              {saving ? 'Adding...' : 'Add Holiday'}
            </button>
          </div>
        </form>
      </div>

      {/* Upcoming Holidays */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-[#101E57] mb-4">
          Upcoming Holidays ({upcomingHolidays.length})
        </h2>
        {upcomingHolidays.length === 0 ? (
          <p className="text-[#667085] text-sm">No upcoming holidays scheduled.</p>
        ) : (
          <div className="space-y-3">
            {upcomingHolidays.map((holiday) => (
              <div
                key={holiday.id}
                className="flex items-center justify-between p-4 rounded-lg bg-[#F6F6F9] border border-gray-100"
              >
                <div>
                  <p className="font-medium text-[#101E57]">{holiday.name}</p>
                  <p className="text-sm text-[#667085]">{formatDate(holiday.date)}</p>
                </div>
                <button
                  onClick={() => handleDeleteHoliday(holiday.id)}
                  className="text-red-600 hover:text-red-700 text-sm font-medium"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Past Holidays */}
      {pastHolidays.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-[#101E57] mb-4">
            Past Holidays ({pastHolidays.length})
          </h2>
          <div className="space-y-3">
            {pastHolidays.map((holiday) => (
              <div
                key={holiday.id}
                className="flex items-center justify-between p-4 rounded-lg bg-gray-50 border border-gray-100 opacity-60"
              >
                <div>
                  <p className="font-medium text-[#101E57]">{holiday.name}</p>
                  <p className="text-sm text-[#667085]">{formatDate(holiday.date)}</p>
                </div>
                <button
                  onClick={() => handleDeleteHoliday(holiday.id)}
                  className="text-red-600 hover:text-red-700 text-sm font-medium"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Info Box */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-sm font-medium text-blue-800">How holidays work</p>
            <p className="text-sm text-blue-700 mt-1">
              On company holidays, all LiveSchool employees will be marked as unavailable for the entire day.
              This applies automatically to all event types and overrides individual availability patterns
              and Google Calendar settings.
            </p>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}

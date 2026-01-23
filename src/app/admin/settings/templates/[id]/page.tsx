'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { PageContainer } from '@/components/AppShell';
import Link from 'next/link';
import type { OHSessionTemplate } from '@/types';

const MEETING_TYPE_OPTIONS = [
  { value: 'one_on_one', label: '1:1 Meeting' },
  { value: 'group', label: 'Group Session' },
  { value: 'round_robin', label: 'Round Robin' },
  { value: 'collective', label: 'Collective (All Hosts)' },
  { value: 'panel', label: 'Panel' },
  { value: 'webinar', label: 'Webinar' },
];

const ICON_OPTIONS = ['📅', '🎯', '💼', '🎓', '🤝', '💡', '🚀', '⭐', '📞', '🎤', '👥', '📊'];

export default function EditTemplatePage() {
  const params = useParams();
  const router = useRouter();
  const templateId = params.id as string;

  const [template, setTemplate] = useState<OHSessionTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    icon: '📅',
    meeting_type: 'group',
    duration_minutes: 30,
    max_attendees: 10,
    min_notice_hours: 24,
    booking_window_days: 30,
    buffer_before: 15,
    buffer_after: 15,
    start_time_increment: 30,
    require_approval: false,
    display_timezone: '',
    lock_timezone: false,
    allow_guests: false,
    guest_limit: 0,
    waitlist_enabled: false,
    waitlist_limit: null as number | null,
    sms_reminders_enabled: false,
    no_show_emails_enabled: false,
    ignore_busy_blocks: false,
    prep_materials: '',
  });

  useEffect(() => {
    fetchTemplate();
  }, [templateId]);

  const fetchTemplate = async () => {
    try {
      const response = await fetch(`/api/session-templates/${templateId}`);
      if (!response.ok) {
        if (response.status === 404) {
          setError('Template not found');
        } else {
          setError('Failed to load template');
        }
        return;
      }
      const data = await response.json();
      setTemplate(data);
      setFormData({
        name: data.name || '',
        description: data.description || '',
        icon: data.icon || '📅',
        meeting_type: data.meeting_type || 'group',
        duration_minutes: data.duration_minutes || 30,
        max_attendees: data.max_attendees || 10,
        min_notice_hours: data.min_notice_hours || 24,
        booking_window_days: data.booking_window_days || 30,
        buffer_before: data.buffer_before || 15,
        buffer_after: data.buffer_after || 15,
        start_time_increment: data.start_time_increment || 30,
        require_approval: data.require_approval || false,
        display_timezone: data.display_timezone || '',
        lock_timezone: data.lock_timezone || false,
        allow_guests: data.allow_guests || false,
        guest_limit: data.guest_limit || 0,
        waitlist_enabled: data.waitlist_enabled || false,
        waitlist_limit: data.waitlist_limit,
        sms_reminders_enabled: data.sms_reminders_enabled || false,
        no_show_emails_enabled: data.no_show_emails_enabled || false,
        ignore_busy_blocks: data.ignore_busy_blocks || false,
        prep_materials: data.prep_materials || '',
      });
    } catch (err) {
      console.error('Failed to fetch template:', err);
      setError('Failed to load template');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/session-templates/${templateId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save template');
      }

      router.push('/admin/settings/templates');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <PageContainer>
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-48" />
          <div className="h-64 bg-gray-200 rounded" />
        </div>
      </PageContainer>
    );
  }

  if (error && !template) {
    return (
      <PageContainer>
        <div className="bg-white rounded-xl border border-[#E0E0E0] p-8 text-center">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="font-medium text-[#101E57] mb-2">{error}</h3>
          <Link href="/admin/settings/templates" className="text-[#6F71EE] hover:underline">
            Back to Templates
          </Link>
        </div>
      </PageContainer>
    );
  }

  if (template?.is_system) {
    return (
      <PageContainer>
        <div className="bg-white rounded-xl border border-[#E0E0E0] p-8 text-center">
          <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h3 className="font-medium text-[#101E57] mb-2">System templates cannot be edited</h3>
          <p className="text-sm text-[#667085] mb-4">
            This is a built-in template. You can use it to create new events, but it cannot be modified.
          </p>
          <Link href="/admin/settings/templates" className="text-[#6F71EE] hover:underline">
            Back to Templates
          </Link>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link
          href="/admin/settings/templates"
          className="p-2 hover:bg-[#F6F6F9] rounded-lg transition"
        >
          <svg className="w-5 h-5 text-[#667085]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-[#101E57]">Edit Template</h1>
          <p className="text-sm text-[#667085]">Update template settings</p>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <div className="bg-white rounded-xl border border-[#E0E0E0] p-6">
          <h2 className="text-lg font-semibold text-[#101E57] mb-4">Basic Information</h2>

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Icon */}
            <div>
              <label className="block text-sm font-medium text-[#101E57] mb-1.5">Icon</label>
              <div className="flex flex-wrap gap-2">
                {ICON_OPTIONS.map((icon) => (
                  <button
                    key={icon}
                    type="button"
                    onClick={() => setFormData({ ...formData, icon })}
                    className={`w-10 h-10 text-xl rounded-lg border-2 transition ${
                      formData.icon === icon
                        ? 'border-[#6F71EE] bg-[#6F71EE]/10'
                        : 'border-[#E0E0E0] hover:border-[#6F71EE]/50'
                    }`}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>

            {/* Meeting Type */}
            <div>
              <label className="block text-sm font-medium text-[#101E57] mb-1.5">Meeting Type</label>
              <select
                value={formData.meeting_type}
                onChange={(e) => setFormData({ ...formData, meeting_type: e.target.value })}
                className="w-full px-3 py-2 border border-[#E0E0E0] rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-transparent"
              >
                {MEETING_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Name */}
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-[#101E57] mb-1.5">Template Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                className="w-full px-3 py-2 border border-[#E0E0E0] rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-transparent"
                placeholder="e.g., Product Demo"
              />
            </div>

            {/* Description */}
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-[#101E57] mb-1.5">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={4}
                className="w-full px-3 py-2 border border-[#E0E0E0] rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-transparent"
                placeholder="Describe what this template is for..."
              />
              <p className="mt-1 text-xs text-[#667085]">
                This description will be used as the default event description when using this template.
              </p>
            </div>
          </div>
        </div>

        {/* Duration & Capacity */}
        <div className="bg-white rounded-xl border border-[#E0E0E0] p-6">
          <h2 className="text-lg font-semibold text-[#101E57] mb-4">Duration & Capacity</h2>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-sm font-medium text-[#101E57] mb-1.5">Duration (minutes)</label>
              <input
                type="number"
                value={formData.duration_minutes}
                onChange={(e) => setFormData({ ...formData, duration_minutes: parseInt(e.target.value) || 30 })}
                min={5}
                max={480}
                className="w-full px-3 py-2 border border-[#E0E0E0] rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#101E57] mb-1.5">Max Attendees</label>
              <input
                type="number"
                value={formData.max_attendees}
                onChange={(e) => setFormData({ ...formData, max_attendees: parseInt(e.target.value) || 1 })}
                min={1}
                max={1000}
                className="w-full px-3 py-2 border border-[#E0E0E0] rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#101E57] mb-1.5">Time Slot Increment</label>
              <select
                value={formData.start_time_increment}
                onChange={(e) => setFormData({ ...formData, start_time_increment: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-[#E0E0E0] rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-transparent"
              >
                <option value={15}>15 minutes</option>
                <option value={30}>30 minutes</option>
                <option value={60}>60 minutes</option>
              </select>
            </div>
          </div>
        </div>

        {/* Buffer Times */}
        <div className="bg-white rounded-xl border border-[#E0E0E0] p-6">
          <h2 className="text-lg font-semibold text-[#101E57] mb-4">Buffer Times</h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-[#101E57] mb-1.5">Buffer Before (minutes)</label>
              <input
                type="number"
                value={formData.buffer_before}
                onChange={(e) => setFormData({ ...formData, buffer_before: parseInt(e.target.value) || 0 })}
                min={0}
                max={120}
                className="w-full px-3 py-2 border border-[#E0E0E0] rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-transparent"
              />
              <p className="mt-1 text-xs text-[#667085]">Time blocked before the meeting starts</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#101E57] mb-1.5">Buffer After (minutes)</label>
              <input
                type="number"
                value={formData.buffer_after}
                onChange={(e) => setFormData({ ...formData, buffer_after: parseInt(e.target.value) || 0 })}
                min={0}
                max={120}
                className="w-full px-3 py-2 border border-[#E0E0E0] rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-transparent"
              />
              <p className="mt-1 text-xs text-[#667085]">Time blocked after the meeting ends</p>
            </div>
          </div>
        </div>

        {/* Booking Rules */}
        <div className="bg-white rounded-xl border border-[#E0E0E0] p-6">
          <h2 className="text-lg font-semibold text-[#101E57] mb-4">Booking Rules</h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-[#101E57] mb-1.5">Minimum Notice (hours)</label>
              <input
                type="number"
                value={formData.min_notice_hours}
                onChange={(e) => setFormData({ ...formData, min_notice_hours: parseInt(e.target.value) || 0 })}
                min={0}
                max={720}
                className="w-full px-3 py-2 border border-[#E0E0E0] rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-transparent"
              />
              <p className="mt-1 text-xs text-[#667085]">How far in advance bookings must be made</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#101E57] mb-1.5">Booking Window (days)</label>
              <input
                type="number"
                value={formData.booking_window_days}
                onChange={(e) => setFormData({ ...formData, booking_window_days: parseInt(e.target.value) || 30 })}
                min={1}
                max={365}
                className="w-full px-3 py-2 border border-[#E0E0E0] rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-transparent"
              />
              <p className="mt-1 text-xs text-[#667085]">How far into the future bookings can be made</p>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={formData.require_approval}
                onChange={(e) => setFormData({ ...formData, require_approval: e.target.checked })}
                className="w-4 h-4 text-[#6F71EE] border-[#E0E0E0] rounded focus:ring-[#6F71EE]"
              />
              <span className="text-sm text-[#101E57]">Require approval for bookings</span>
            </label>

            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={formData.allow_guests}
                onChange={(e) => setFormData({ ...formData, allow_guests: e.target.checked })}
                className="w-4 h-4 text-[#6F71EE] border-[#E0E0E0] rounded focus:ring-[#6F71EE]"
              />
              <span className="text-sm text-[#101E57]">Allow attendees to bring guests</span>
            </label>

            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={formData.ignore_busy_blocks}
                onChange={(e) => setFormData({ ...formData, ignore_busy_blocks: e.target.checked })}
                className="w-4 h-4 text-[#6F71EE] border-[#E0E0E0] rounded focus:ring-[#6F71EE]"
              />
              <span className="text-sm text-[#101E57]">Ignore calendar busy blocks (allow any time)</span>
            </label>
          </div>
        </div>

        {/* Features */}
        <div className="bg-white rounded-xl border border-[#E0E0E0] p-6">
          <h2 className="text-lg font-semibold text-[#101E57] mb-4">Features</h2>

          <div className="space-y-3">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={formData.waitlist_enabled}
                onChange={(e) => setFormData({ ...formData, waitlist_enabled: e.target.checked })}
                className="w-4 h-4 text-[#6F71EE] border-[#E0E0E0] rounded focus:ring-[#6F71EE]"
              />
              <span className="text-sm text-[#101E57]">Enable waitlist when slots are full</span>
            </label>

            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={formData.sms_reminders_enabled}
                onChange={(e) => setFormData({ ...formData, sms_reminders_enabled: e.target.checked })}
                className="w-4 h-4 text-[#6F71EE] border-[#E0E0E0] rounded focus:ring-[#6F71EE]"
              />
              <span className="text-sm text-[#101E57]">Enable SMS reminders</span>
            </label>

            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={formData.no_show_emails_enabled}
                onChange={(e) => setFormData({ ...formData, no_show_emails_enabled: e.target.checked })}
                className="w-4 h-4 text-[#6F71EE] border-[#E0E0E0] rounded focus:ring-[#6F71EE]"
              />
              <span className="text-sm text-[#101E57]">Send no-show follow-up emails</span>
            </label>
          </div>
        </div>

        {/* Prep Materials */}
        <div className="bg-white rounded-xl border border-[#E0E0E0] p-6">
          <h2 className="text-lg font-semibold text-[#101E57] mb-4">Preparation Materials</h2>

          <textarea
            value={formData.prep_materials}
            onChange={(e) => setFormData({ ...formData, prep_materials: e.target.value })}
            rows={4}
            className="w-full px-3 py-2 border border-[#E0E0E0] rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-transparent"
            placeholder="Add any preparation instructions or materials for attendees..."
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-[#E0E0E0]">
          <Link
            href="/admin/settings/templates"
            className="px-4 py-2 text-[#667085] hover:text-[#101E57] transition"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving || !formData.name.trim()}
            className="px-6 py-2 bg-[#6F71EE] text-white rounded-lg hover:bg-[#5B5DD6] transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {saving ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </button>
        </div>
      </form>
    </PageContainer>
  );
}

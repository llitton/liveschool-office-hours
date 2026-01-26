'use client';

import { useState, useEffect, useMemo } from 'react';
import { PageContainer, PageHeader } from '@/components/AppShell';

interface Admin {
  id: string;
  email: string;
  name: string | null;
  created_at: string;
  google_connected: boolean;
  timezone: string | null;
  weekly_available_hours: number;
  max_meetings_per_day: number;
  max_meetings_per_week: number;
  default_buffer_before: number;
  default_buffer_after: number;
  profile_image: string | null;
  invitation_sent_at: string | null;
  invitation_last_sent_at: string | null;
}

const TIMEZONE_LABELS: Record<string, string> = {
  'America/New_York': 'Eastern (ET)',
  'America/Chicago': 'Central (CT)',
  'America/Denver': 'Mountain (MT)',
  'America/Phoenix': 'Arizona (MST)',
  'America/Los_Angeles': 'Pacific (PT)',
  'America/Anchorage': 'Alaska (AKT)',
  'Pacific/Honolulu': 'Hawaii (HST)',
};

function getTimezoneLabel(tz: string | null): string {
  if (!tz) return 'Not set';
  return TIMEZONE_LABELS[tz] || tz;
}

export default function PeoplePage() {
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [resending, setResending] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchAdmins();
  }, []);

  const fetchAdmins = async () => {
    try {
      const response = await fetch('/api/admin/team');
      if (response.ok) {
        const data = await response.json();
        setAdmins(data);
      }
    } catch (err) {
      setError('Failed to load team members');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim()) return;

    setAdding(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/admin/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: newEmail.toLowerCase().trim(),
          name: newName.trim() || null,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to add team member');
      }

      const newAdmin = await response.json();
      setAdmins([...admins, newAdmin]);
      setNewEmail('');
      setNewName('');
      setSuccess('Team member added successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add team member');
    } finally {
      setAdding(false);
    }
  };

  const handleRemoveAdmin = async (adminId: string, email: string) => {
    if (!confirm(`Are you sure you want to remove ${email} from the team?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/team?id=${adminId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to remove team member');
      }

      setAdmins(admins.filter((a) => a.id !== adminId));
      setSuccess('Team member removed');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('Failed to remove team member');
      console.error(err);
    }
  };

  const handleResendInvite = async (adminId: string, email: string) => {
    setResending(adminId);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`/api/admin/team/${adminId}/resend-invite`, {
        method: 'POST',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to resend invitation');
      }

      const { sent_at } = await response.json();

      // Update the admin in the list with new invitation timestamp
      setAdmins(admins.map((a) =>
        a.id === adminId
          ? { ...a, invitation_last_sent_at: sent_at }
          : a
      ));

      setSuccess(`Invitation resent to ${email}`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resend invitation');
    } finally {
      setResending(null);
    }
  };

  // Format relative time for invitation sent
  const formatInviteSentTime = (dateStr: string | null) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  // Filter admins based on search query
  const filteredAdmins = useMemo(() => {
    if (!searchQuery.trim()) return admins;
    const query = searchQuery.toLowerCase();
    return admins.filter(admin =>
      admin.email.toLowerCase().includes(query) ||
      (admin.name && admin.name.toLowerCase().includes(query))
    );
  }, [admins, searchQuery]);

  if (loading) {
    return (
      <PageContainer narrow>
        <PageHeader
          title="People"
          description="Manage your team and who can host sessions."
        />
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-48 mb-4" />
          <div className="h-4 bg-gray-200 rounded w-96 mb-8" />
          <div className="h-64 bg-gray-200 rounded" />
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer narrow>
      <PageHeader
        title="People"
        description="Manage your team and who can host sessions."
      />

        {error && (
          <div className="bg-red-50 text-red-700 p-3 rounded-lg mb-4 text-sm">{error}</div>
        )}

        {success && (
          <div className="bg-green-50 text-green-700 p-3 rounded-lg mb-4 text-sm">{success}</div>
        )}

        {/* Header with Add button and Search */}
        <div className="flex items-center justify-between gap-4 mb-4">
          <div className="relative flex-1 max-w-sm">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#667085]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-[#E0E0E0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6F71EE]/20 focus:border-[#6F71EE]"
            />
          </div>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-2 bg-[#6F71EE] text-white px-4 py-2 rounded-lg hover:bg-[#5a5cd0] transition font-medium text-sm"
          >
            {showAddForm ? (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Cancel
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Team Member
              </>
            )}
          </button>
        </div>

        {/* Collapsible Add Team Member Form */}
        {showAddForm && (
          <div className="bg-white rounded-xl shadow-sm border border-[#E0E0E0] p-5 mb-4">
            <form onSubmit={handleAddAdmin} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#101E57] mb-1">
                    Email address
                  </label>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="colleague@liveschoolinc.com"
                    className="w-full px-3 py-2 border border-[#E0E0E0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6F71EE]/20 focus:border-[#6F71EE]"
                    required
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#101E57] mb-1">
                    Name <span className="text-[#98A2B3] font-normal">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="First name"
                    className="w-full px-3 py-2 border border-[#E0E0E0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6F71EE]/20 focus:border-[#6F71EE]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <p className="text-xs text-[#667085]">
                  They&apos;ll receive an invitation email to connect their Google account.
                </p>
                <button
                  type="submit"
                  disabled={adding || !newEmail.trim()}
                  className="bg-[#101E57] text-white px-5 py-2 rounded-lg hover:bg-[#1a2d6e] transition disabled:opacity-50 font-medium text-sm"
                >
                  {adding ? 'Adding...' : 'Send Invitation'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Team Members Table */}
        <div className="bg-white rounded-xl shadow-sm border border-[#E0E0E0] overflow-hidden">
          {admins.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-14 h-14 bg-[#F6F6F9] rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-[#667085]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="font-semibold text-[#101E57] mb-2">No team members yet</h3>
              <p className="text-sm text-[#667085] max-w-xs mx-auto mb-4">
                You&apos;re the only one here. Add team members to let others host sessions.
              </p>
              <button
                onClick={() => setShowAddForm(true)}
                className="inline-flex items-center gap-2 bg-[#6F71EE] text-white px-4 py-2 rounded-lg hover:bg-[#5a5cd0] transition font-medium text-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Your First Team Member
              </button>
            </div>
          ) : filteredAdmins.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-[#667085]">No team members match &quot;{searchQuery}&quot;</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-[#FAFAFA] border-b border-[#E0E0E0]">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-medium text-[#667085] uppercase tracking-wider">Member</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-[#667085] uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-[#667085] uppercase tracking-wider hidden sm:table-cell">Timezone</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-[#667085] uppercase tracking-wider hidden md:table-cell">Limits</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-[#667085] uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E0E0E0]">
                {filteredAdmins.map((admin, index) => (
                  <tr key={admin.id} className="hover:bg-[#FAFAFA] transition">
                    {/* Member */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {admin.profile_image ? (
                          <img
                            src={admin.profile_image}
                            alt={admin.name || admin.email}
                            className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                          />
                        ) : (
                          <div className="w-8 h-8 bg-[#6F71EE]/10 rounded-full flex items-center justify-center text-[#6F71EE] font-semibold text-sm flex-shrink-0">
                            {(admin.name || admin.email)[0].toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-[#101E57] text-sm truncate">
                              {admin.name || admin.email.split('@')[0]}
                            </p>
                            {index === 0 && (
                              <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-[#101E57] text-white flex-shrink-0">
                                Owner
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-[#667085] truncate">{admin.email}</p>
                        </div>
                      </div>
                    </td>
                    {/* Status */}
                    <td className="px-4 py-3">
                      {admin.google_connected ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 text-xs font-medium rounded-full border border-green-200">
                          <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                          Active
                        </span>
                      ) : (
                        <div>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 text-xs font-medium rounded-full border border-amber-200">
                            <span className="w-1.5 h-1.5 bg-amber-500 rounded-full"></span>
                            Pending
                          </span>
                          {admin.invitation_last_sent_at && (
                            <p className="text-[10px] text-[#667085] mt-0.5">
                              Invited {formatInviteSentTime(admin.invitation_last_sent_at)}
                            </p>
                          )}
                        </div>
                      )}
                    </td>
                    {/* Timezone */}
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className={`text-sm ${admin.timezone ? 'text-[#101E57]' : 'text-amber-600'}`}>
                        {getTimezoneLabel(admin.timezone)}
                      </span>
                    </td>
                    {/* Limits */}
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-sm text-[#667085]">
                        {admin.max_meetings_per_day}/day
                        {admin.default_buffer_before + admin.default_buffer_after > 0 && (
                          <span className="text-[#98A2B3]"> · {admin.default_buffer_before + admin.default_buffer_after}m buffer</span>
                        )}
                      </span>
                    </td>
                    {/* Actions */}
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {!admin.google_connected && (
                          <button
                            onClick={() => handleResendInvite(admin.id, admin.email)}
                            disabled={resending === admin.id}
                            className="text-xs text-[#6F71EE] hover:text-[#5a5cd0] font-medium disabled:opacity-50"
                          >
                            {resending === admin.id ? 'Sending...' : 'Resend'}
                          </button>
                        )}
                        {index !== 0 && (
                          <button
                            onClick={() => handleRemoveAdmin(admin.id, admin.email)}
                            className="text-xs text-red-600 hover:text-red-700 font-medium"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Team count */}
        {admins.length > 0 && (
          <p className="text-xs text-[#667085] mt-3 text-center">
            {admins.length} team member{admins.length !== 1 ? 's' : ''}
            {searchQuery && filteredAdmins.length !== admins.length && ` (${filteredAdmins.length} shown)`}
          </p>
        )}
    </PageContainer>
  );
}

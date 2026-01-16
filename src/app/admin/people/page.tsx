'use client';

import { useState, useEffect } from 'react';
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
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');

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
          <div className="bg-red-50 text-red-700 p-4 rounded-lg mb-6 text-sm">{error}</div>
        )}

        {success && (
          <div className="bg-green-50 text-green-700 p-4 rounded-lg mb-6 text-sm">{success}</div>
        )}

        {/* Add Team Member */}
        <div className="bg-white rounded-xl shadow-sm border border-[#E0E0E0] p-6 mb-8">
          <h2 className="text-lg font-semibold text-[#101E57] mb-4">Add team member</h2>
          <form onSubmit={handleAddAdmin} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#101E57] mb-1.5">
                  Email address
                </label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="colleague@liveschoolinc.com"
                  className="w-full px-4 py-2.5 border border-[#E0E0E0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6F71EE]/20 focus:border-[#6F71EE]"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#101E57] mb-1.5">
                  Name <span className="text-[#98A2B3] font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="First name"
                  className="w-full px-4 py-2.5 border border-[#E0E0E0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6F71EE]/20 focus:border-[#6F71EE]"
                />
              </div>
            </div>

            <div className="bg-[#FAFAFA] rounded-lg p-4">
              <p className="text-sm font-medium text-[#101E57] mb-2">What they&apos;ll be able to do</p>
              <ul className="text-sm text-[#667085] space-y-1">
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-[#10B981]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Sign in with their Google account
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-[#10B981]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Host and manage sessions
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-[#10B981]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  View bookings and insights
                </li>
              </ul>
            </div>

            <button
              type="submit"
              disabled={adding || !newEmail.trim()}
              className="bg-[#101E57] text-white px-6 py-2.5 rounded-lg hover:bg-[#1a2d6e] transition disabled:opacity-50 font-medium"
            >
              {adding ? 'Adding...' : 'Add team member'}
            </button>
          </form>
        </div>

        {/* Team Members List */}
        <div className="bg-white rounded-xl shadow-sm border border-[#E0E0E0] overflow-hidden">
          <div className="px-6 py-4 border-b border-[#E0E0E0]">
            <h2 className="text-lg font-semibold text-[#101E57]">Team members</h2>
          </div>

          {admins.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-14 h-14 bg-[#F6F6F9] rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-[#667085]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="font-semibold text-[#101E57] mb-2">No team members yet</h3>
              <p className="text-sm text-[#667085] max-w-xs mx-auto">
                You&apos;re the only one here right now. Add team members above to let others host sessions.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#E0E0E0]">
              {admins.map((admin, index) => (
                <div key={admin.id} className="px-6 py-4 hover:bg-[#FAFAFA] transition">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      {admin.profile_image ? (
                        <img
                          src={admin.profile_image}
                          alt={admin.name || admin.email}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 bg-[#6F71EE]/10 rounded-full flex items-center justify-center text-[#6F71EE] font-semibold">
                          {(admin.name || admin.email)[0].toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-[#101E57]">
                            {admin.name || admin.email.split('@')[0]}
                          </p>
                          <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                            index === 0 ? 'bg-[#101E57] text-white' : 'bg-[#F6F6F9] text-[#667085]'
                          }`}>
                            {index === 0 ? 'Owner' : 'Team member'}
                          </span>
                          {admin.google_connected ? (
                            <span className="flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 text-xs font-medium rounded-full">
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                              </svg>
                              Connected
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-amber-50 text-amber-700 text-xs font-medium rounded-full">
                              Not connected
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-[#667085]">{admin.email}</p>
                      </div>
                    </div>
                    {index !== 0 && (
                      <button
                        onClick={() => handleRemoveAdmin(admin.id, admin.email)}
                        className="text-sm text-red-600 hover:text-red-700 font-medium"
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  <div className="ml-[52px] grid grid-cols-4 gap-3">
                    <div className="bg-[#FAFAFA] rounded-lg px-3 py-2">
                      <p className="text-xs text-[#667085] mb-0.5">Timezone</p>
                      <p className={`text-sm font-medium ${admin.timezone ? 'text-[#101E57]' : 'text-amber-600'}`}>
                        {getTimezoneLabel(admin.timezone)}
                      </p>
                    </div>
                    <div className="bg-[#FAFAFA] rounded-lg px-3 py-2">
                      <p className="text-xs text-[#667085] mb-0.5">Availability</p>
                      <p className={`text-sm font-medium ${admin.weekly_available_hours > 0 ? 'text-[#101E57]' : 'text-amber-600'}`}>
                        {admin.weekly_available_hours > 0 ? `${admin.weekly_available_hours}h/week` : 'Not set'}
                      </p>
                    </div>
                    <div className="bg-[#FAFAFA] rounded-lg px-3 py-2">
                      <p className="text-xs text-[#667085] mb-0.5">Meeting limits</p>
                      <p className="text-sm font-medium text-[#101E57]">
                        {admin.max_meetings_per_day}/day
                      </p>
                    </div>
                    <div className="bg-[#FAFAFA] rounded-lg px-3 py-2">
                      <p className="text-xs text-[#667085] mb-0.5">Buffer time</p>
                      <p className="text-sm font-medium text-[#101E57]">
                        {admin.default_buffer_before + admin.default_buffer_after}m total
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
    </PageContainer>
  );
}

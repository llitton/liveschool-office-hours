'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import AdminNav from '@/components/AdminNav';

interface Admin {
  id: string;
  email: string;
  name: string | null;
  created_at: string;
}

export default function TeamPage() {
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form state
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
      <div className="min-h-screen bg-[#F6F6F9] flex items-center justify-center">
        <p className="text-[#667085]">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F6F6F9]">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-4">
              <Image
                src="https://info.whyliveschool.com/hubfs/Brand/liveschool-logo.png"
                alt="LiveSchool"
                width={140}
                height={36}
              />
              <span className="text-[#667085] text-sm font-medium">Office Hours</span>
            </div>
            <a
              href="/api/auth/logout"
              className="text-red-600 hover:text-red-700 text-sm font-medium"
            >
              Sign out
            </a>
          </div>
          <AdminNav />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-[#101E57]">Team Members</h1>
          <p className="text-[#667085] mt-1">
            Manage who can access the Office Hours admin dashboard
          </p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-700 p-4 rounded-lg mb-6 text-sm">{error}</div>
        )}

        {success && (
          <div className="bg-green-50 text-green-700 p-4 rounded-lg mb-6 text-sm">{success}</div>
        )}

        {/* Add New Admin */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <h2 className="text-lg font-semibold text-[#101E57] mb-4">Add Team Member</h2>
          <form onSubmit={handleAddAdmin} className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-[#101E57] mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="colleague@liveschoolinc.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57]"
                  required
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-[#101E57] mb-1">
                  Name (optional)
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="First name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57]"
                />
              </div>
            </div>

            {/* Access info - inline helper */}
            <div className="bg-[#F6F6F9] rounded-lg p-3 flex items-start gap-3">
              <svg className="w-5 h-5 text-[#6F71EE] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="text-sm text-[#667085]">
                <p className="font-medium text-[#101E57] mb-1">What they&apos;ll be able to do:</p>
                <ul className="space-y-0.5">
                  <li>• Sign in with their Google account</li>
                  <li>• Create and manage office hours events</li>
                  <li>• View all bookings and analytics</li>
                  <li>• Configure integrations</li>
                </ul>
              </div>
            </div>

            <button
              type="submit"
              disabled={adding || !newEmail.trim()}
              className="bg-[#6F71EE] text-white px-6 py-2 rounded-lg hover:bg-[#5a5cd0] transition disabled:opacity-50 font-medium"
            >
              {adding ? 'Adding...' : 'Add Team Member'}
            </button>
          </form>
        </div>

        {/* Current Admins */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-[#101E57]">Current Team Members</h2>
          </div>

          {admins.length === 0 ? (
            <div className="p-8 text-center">
              <div className="w-12 h-12 bg-[#F6F6F9] rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-[#667085]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="text-[#101E57] font-medium mb-1">No team members yet</h3>
              <p className="text-sm text-[#667085] max-w-xs mx-auto">
                You&apos;re the only admin right now. Add team members above to give them access to manage Office Hours.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {admins.map((admin, index) => (
                <div
                  key={admin.id}
                  className="px-6 py-4 flex items-center justify-between hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#6F71EE]/10 rounded-full flex items-center justify-center text-[#6F71EE] font-medium">
                      {(admin.name || admin.email)[0].toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-[#101E57] font-medium">
                          {admin.name || admin.email.split('@')[0]}
                        </p>
                        <span className="px-2 py-0.5 bg-[#6F71EE]/10 text-[#6F71EE] text-xs font-medium rounded-full">
                          {index === 0 ? 'Owner' : 'Admin'}
                        </span>
                      </div>
                      <p className="text-sm text-[#667085]">{admin.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-[#667085]">
                      Added {new Date(admin.created_at).toLocaleDateString()}
                    </span>
                    {index !== 0 && (
                      <button
                        onClick={() => handleRemoveAdmin(admin.id, admin.email)}
                        className="text-red-600 hover:text-red-700 text-sm font-medium"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Role explanation */}
        <div className="mt-4 flex items-center justify-center gap-6 text-xs text-[#667085]">
          <div className="flex items-center gap-1.5">
            <span className="px-2 py-0.5 bg-[#6F71EE]/10 text-[#6F71EE] font-medium rounded-full">Owner</span>
            <span>Full access, cannot be removed</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="px-2 py-0.5 bg-[#6F71EE]/10 text-[#6F71EE] font-medium rounded-full">Admin</span>
            <span>Full access</span>
          </div>
        </div>
      </main>
    </div>
  );
}

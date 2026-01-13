'use client';

import { useState, useEffect } from 'react';

interface Admin {
  id: string;
  name: string;
  email: string;
}

interface EventHost {
  id: string;
  admin_id: string;
  role: 'owner' | 'host' | 'backup';
  can_manage_slots: boolean;
  can_view_bookings: boolean;
  admin: Admin;
}

interface HostSelectorProps {
  eventId: string;
  currentUserId?: string;
  onHostsChange?: () => void;
}

export default function HostSelector({ eventId, currentUserId, onHostsChange }: HostSelectorProps) {
  const [allAdmins, setAllAdmins] = useState<Admin[]>([]);
  const [hosts, setHosts] = useState<EventHost[]>([]);
  const [owner, setOwner] = useState<Admin | null>(null);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [selectedAdminId, setSelectedAdminId] = useState('');
  const [selectedRole, setSelectedRole] = useState<'host' | 'backup'>('host');
  const [error, setError] = useState('');

  useEffect(() => {
    fetchData();
  }, [eventId]);

  const fetchData = async () => {
    try {
      const [adminsRes, hostsRes] = await Promise.all([
        fetch('/api/admin/team'),
        fetch(`/api/events/${eventId}/hosts`),
      ]);

      if (adminsRes.ok) {
        const adminsData = await adminsRes.json();
        setAllAdmins(adminsData);
      }

      if (hostsRes.ok) {
        const hostsData = await hostsRes.json();
        setHosts(hostsData.hosts || []);
        setOwner(hostsData.owner);
      }
    } catch (err) {
      console.error('Failed to fetch host data:', err);
    } finally {
      setLoading(false);
    }
  };

  const addHost = async () => {
    if (!selectedAdminId) return;

    setAdding(true);
    setError('');

    try {
      const response = await fetch(`/api/events/${eventId}/hosts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          admin_id: selectedAdminId,
          role: selectedRole,
          can_manage_slots: true,
          can_view_bookings: true,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to add host');
      }

      const newHost = await response.json();
      setHosts([...hosts, newHost]);
      setSelectedAdminId('');
      onHostsChange?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add host');
    } finally {
      setAdding(false);
    }
  };

  const removeHost = async (hostId: string) => {
    try {
      const response = await fetch(`/api/events/${eventId}/hosts?hostId=${hostId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to remove host');
      }

      setHosts(hosts.filter((h) => h.id !== hostId));
      onHostsChange?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove host');
    }
  };

  const updateHostPermissions = async (
    hostId: string,
    updates: { role?: string; can_manage_slots?: boolean; can_view_bookings?: boolean }
  ) => {
    try {
      const response = await fetch(`/api/events/${eventId}/hosts`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostId, ...updates }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update host');
      }

      const updatedHost = await response.json();
      setHosts(hosts.map((h) => (h.id === hostId ? updatedHost : h)));
      onHostsChange?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update host');
    }
  };

  // Filter out admins who are already hosts or the owner
  const availableAdmins = allAdmins.filter(
    (admin) =>
      admin.id !== owner?.id &&
      !hosts.some((h) => h.admin_id === admin.id)
  );

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
        <div className="h-10 bg-gray-200 rounded mb-2"></div>
        <div className="h-10 bg-gray-200 rounded"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-[#101E57]">Event Hosts</h3>

      {error && (
        <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm">{error}</div>
      )}

      {/* Owner */}
      {owner && (
        <div className="flex items-center justify-between p-3 bg-[#6F71EE]/5 border border-[#6F71EE]/20 rounded-lg">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#6F71EE] text-white flex items-center justify-center text-sm font-medium">
              {owner.name?.charAt(0) || owner.email.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="font-medium text-[#101E57]">{owner.name || owner.email}</p>
              <p className="text-sm text-[#667085]">{owner.email}</p>
            </div>
          </div>
          <span className="px-2 py-1 bg-[#6F71EE] text-white text-xs rounded-full font-medium">
            Owner
          </span>
        </div>
      )}

      {/* Co-hosts */}
      {hosts.map((host) => (
        <div
          key={host.id}
          className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center text-sm font-medium">
              {host.admin?.name?.charAt(0) || host.admin?.email?.charAt(0)?.toUpperCase()}
            </div>
            <div>
              <p className="font-medium text-[#101E57]">{host.admin?.name || host.admin?.email}</p>
              <p className="text-sm text-[#667085]">{host.admin?.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={host.role}
              onChange={(e) => updateHostPermissions(host.id, { role: e.target.value })}
              className="text-sm border border-gray-300 rounded px-2 py-1 text-[#667085]"
            >
              <option value="host">Host</option>
              <option value="backup">Backup</option>
            </select>
            <button
              onClick={() => removeHost(host.id)}
              className="text-red-600 hover:text-red-700 text-sm font-medium"
            >
              Remove
            </button>
          </div>
        </div>
      ))}

      {/* Add new host */}
      {availableAdmins.length > 0 && (
        <div className="flex items-center gap-3 p-3 bg-[#F6F6F9] rounded-lg">
          <select
            value={selectedAdminId}
            onChange={(e) => setSelectedAdminId(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57]"
          >
            <option value="">Select team member...</option>
            {availableAdmins.map((admin) => (
              <option key={admin.id} value={admin.id}>
                {admin.name || admin.email}
              </option>
            ))}
          </select>
          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value as 'host' | 'backup')}
            className="px-3 py-2 border border-gray-300 rounded-lg text-[#667085]"
          >
            <option value="host">Host</option>
            <option value="backup">Backup</option>
          </select>
          <button
            onClick={addHost}
            disabled={!selectedAdminId || adding}
            className="bg-[#6F71EE] text-white px-4 py-2 rounded-lg hover:bg-[#5a5cd0] transition disabled:opacity-50 font-medium"
          >
            {adding ? 'Adding...' : 'Add'}
          </button>
        </div>
      )}

      {availableAdmins.length === 0 && hosts.length > 0 && (
        <p className="text-sm text-[#667085] text-center py-2">
          All team members have been added as hosts
        </p>
      )}

      {/* Permissions info */}
      <div className="text-xs text-[#667085] mt-4">
        <p><strong>Host</strong> - Can manage slots and view all bookings</p>
        <p><strong>Backup</strong> - Can view bookings, assigned as backup host</p>
      </div>
    </div>
  );
}

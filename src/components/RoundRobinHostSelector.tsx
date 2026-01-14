'use client';

import { useState, useEffect } from 'react';

interface Host {
  id: string;
  admin_id: string;
  role: 'owner' | 'host' | 'backup';
  admin: {
    id: string;
    name: string | null;
    email: string;
  };
}

interface HostStats {
  hostId: string;
  hostName: string;
  bookingCount: number;
  percentage: number;
}

interface RoundRobinHostSelectorProps {
  eventId: string;
}

export default function RoundRobinHostSelector({ eventId }: RoundRobinHostSelectorProps) {
  const [hosts, setHosts] = useState<Host[]>([]);
  const [owner, setOwner] = useState<{ id: string; name: string | null; email: string } | null>(null);
  const [stats, setStats] = useState<{
    totalAssignments: number;
    hostStats: HostStats[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [eventId]);

  const fetchData = async () => {
    try {
      // Fetch hosts for this event
      const hostsRes = await fetch(`/api/events/${eventId}/hosts`);
      if (hostsRes.ok) {
        const hostsData = await hostsRes.json();
        setHosts(hostsData.hosts || []);
        setOwner(hostsData.owner);
      }

      // Fetch round-robin stats
      const statsRes = await fetch(`/api/events/${eventId}/round-robin`);
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }
    } catch (err) {
      console.error('Failed to fetch host data:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-20 bg-gray-100 rounded-lg"></div>
      </div>
    );
  }

  // All participants = owner + hosts with role 'host'
  const participants = [
    ...(owner ? [{ id: owner.id, name: owner.name, email: owner.email, isOwner: true }] : []),
    ...hosts
      .filter((h) => h.role === 'host')
      .map((h) => ({
        id: h.admin.id,
        name: h.admin.name,
        email: h.admin.email,
        isOwner: false,
      })),
  ];

  if (participants.length === 0) {
    return (
      <div className="text-center py-6 bg-[#F6F6F9] rounded-lg">
        <p className="text-[#667085]">No hosts configured for this event.</p>
        <p className="text-sm text-[#667085] mt-1">
          Add hosts in the &quot;Event Hosts&quot; section above to enable round-robin.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      {stats && stats.totalAssignments > 0 && (
        <div className="bg-[#6F71EE]/5 border border-[#6F71EE]/20 rounded-lg p-4">
          <p className="text-sm text-[#101E57]">
            <span className="font-semibold">{stats.totalAssignments}</span> bookings distributed
            across <span className="font-semibold">{participants.length}</span> hosts
          </p>
        </div>
      )}

      {/* Host list with distribution */}
      <div className="space-y-2">
        {participants.map((participant) => {
          const hostStat = stats?.hostStats.find((s) => s.hostId === participant.id);
          const bookingCount = hostStat?.bookingCount || 0;
          const percentage = hostStat?.percentage || 0;

          return (
            <div
              key={participant.id}
              className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    participant.isOwner
                      ? 'bg-[#6F71EE] text-white'
                      : 'bg-gray-200 text-gray-600'
                  }`}
                >
                  {participant.name?.charAt(0) || participant.email.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-medium text-[#101E57]">
                    {participant.name || participant.email}
                    {participant.isOwner && (
                      <span className="ml-2 text-xs px-2 py-0.5 bg-[#6F71EE]/10 text-[#6F71EE] rounded-full">
                        Owner
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-[#667085]">{participant.email}</p>
                </div>
              </div>

              {/* Distribution stats */}
              <div className="text-right">
                <p className="text-sm font-medium text-[#101E57]">
                  {bookingCount} booking{bookingCount !== 1 ? 's' : ''}
                </p>
                {stats && stats.totalAssignments > 0 && (
                  <div className="flex items-center gap-2 mt-1">
                    <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#6F71EE] rounded-full"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <span className="text-xs text-[#667085]">{percentage}%</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Info text */}
      <p className="text-xs text-[#667085]">
        All hosts with &quot;Host&quot; role will receive bookings in rotation. Backup hosts are
        excluded from round-robin distribution.
      </p>
    </div>
  );
}

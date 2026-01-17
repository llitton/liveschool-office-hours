'use client';

import { useState, useEffect } from 'react';

interface Host {
  id: string;
  admin_id: string;
  role: 'owner' | 'host' | 'backup';
  priority?: number;
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
  showPriority?: boolean;
}

export default function RoundRobinHostSelector({ eventId, showPriority = false }: RoundRobinHostSelectorProps) {
  const [hosts, setHosts] = useState<Host[]>([]);
  const [owner, setOwner] = useState<{ id: string; name: string | null; email: string } | null>(null);
  const [stats, setStats] = useState<{
    totalAssignments: number;
    hostStats: HostStats[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingPriority, setUpdatingPriority] = useState<string | null>(null);

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

  const updatePriority = async (hostRecordId: string, newPriority: number) => {
    setUpdatingPriority(hostRecordId);
    try {
      const res = await fetch(`/api/events/${eventId}/hosts`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostId: hostRecordId, priority: newPriority }),
      });
      if (res.ok) {
        // Update local state
        setHosts(prev => prev.map(h =>
          h.id === hostRecordId ? { ...h, priority: newPriority } : h
        ));
      }
    } catch (err) {
      console.error('Failed to update priority:', err);
    } finally {
      setUpdatingPriority(null);
    }
  };

  const PriorityStars = ({ hostRecordId, currentPriority }: { hostRecordId: string; currentPriority: number }) => {
    const [hoverPriority, setHoverPriority] = useState<number | null>(null);
    const displayPriority = hoverPriority ?? currentPriority;
    const isUpdating = updatingPriority === hostRecordId;

    return (
      <div
        className={`flex gap-0.5 ${isUpdating ? 'opacity-50' : ''}`}
        onMouseLeave={() => setHoverPriority(null)}
      >
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            disabled={isUpdating}
            onMouseEnter={() => setHoverPriority(star)}
            onClick={() => updatePriority(hostRecordId, star)}
            className="text-lg leading-none transition-colors disabled:cursor-wait"
            title={`Priority ${star}`}
          >
            <span className={star <= displayPriority ? 'text-yellow-400' : 'text-gray-300'}>
              ★
            </span>
          </button>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-20 bg-gray-100 rounded-lg"></div>
      </div>
    );
  }

  // All participants = owner + hosts with role 'host' or 'owner'
  // For round-robin, we use the hosts from oh_event_hosts table
  const participatingHosts = hosts.filter((h) => h.role === 'host' || h.role === 'owner');

  // Map to include all needed info
  const participants = participatingHosts.map((h) => ({
    id: h.admin.id,
    hostRecordId: h.id, // The oh_event_hosts record ID for updates
    name: h.admin.name,
    email: h.admin.email,
    isOwner: h.role === 'owner',
    priority: h.priority ?? 3,
  }));

  // If owner exists but isn't in hosts list (legacy setup), add them
  if (owner && !participants.find(p => p.id === owner.id)) {
    participants.unshift({
      id: owner.id,
      hostRecordId: '', // No record to update
      name: owner.name,
      email: owner.email,
      isOwner: true,
      priority: 3, // Default priority
    });
  }

  // Sort by priority (descending) when showing priorities
  if (showPriority) {
    participants.sort((a, b) => b.priority - a.priority);
  }

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

              <div className="flex items-center gap-4">
                {/* Priority stars */}
                {showPriority && participant.hostRecordId && (
                  <PriorityStars
                    hostRecordId={participant.hostRecordId}
                    currentPriority={participant.priority}
                  />
                )}
                {showPriority && !participant.hostRecordId && (
                  <div className="flex gap-0.5 opacity-50" title="Add as host to set priority">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <span key={star} className={star <= 3 ? 'text-yellow-400' : 'text-gray-300'}>
                        ★
                      </span>
                    ))}
                  </div>
                )}

                {/* Distribution stats */}
                <div className="text-right min-w-[80px]">
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

'use client';

import { useState, useEffect, useCallback } from 'react';

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

  // Calculate expected percentage distribution based on priorities
  const calculateExpectedPercentage = useCallback((priority: number, allPriorities: number[]) => {
    const total = allPriorities.reduce((sum, p) => sum + p, 0);
    if (total === 0) return 0;
    return Math.round((priority / total) * 100);
  }, []);

  // Priority Slider Component
  const PrioritySlider = ({
    hostRecordId,
    currentPriority,
    expectedPercentage
  }: {
    hostRecordId: string;
    currentPriority: number;
    expectedPercentage: number;
  }) => {
    const [localValue, setLocalValue] = useState(currentPriority);
    const isUpdating = updatingPriority === hostRecordId;

    useEffect(() => {
      setLocalValue(currentPriority);
    }, [currentPriority]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = parseInt(e.target.value);
      setLocalValue(value);
    };

    const handleCommit = () => {
      if (localValue !== currentPriority) {
        updatePriority(hostRecordId, localValue);
      }
    };

    return (
      <div className={`flex items-center gap-3 ${isUpdating ? 'opacity-50' : ''}`}>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={1}
            max={10}
            value={localValue}
            onChange={handleChange}
            onMouseUp={handleCommit}
            onTouchEnd={handleCommit}
            disabled={isUpdating}
            className="w-24 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#6F71EE]"
          />
          <span className="text-sm font-medium text-[#101E57] w-6 text-center">
            {localValue}
          </span>
        </div>
        <div className="flex items-center gap-1 px-2 py-1 bg-[#6F71EE]/10 rounded text-xs font-medium text-[#6F71EE]">
          ~{expectedPercentage}%
        </div>
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
    priority: h.priority ?? 5,
  }));

  // If owner exists but isn't in hosts list (legacy setup), add them
  if (owner && !participants.find(p => p.id === owner.id)) {
    participants.unshift({
      id: owner.id,
      hostRecordId: '', // No record to update
      name: owner.name,
      email: owner.email,
      isOwner: true,
      priority: 5, // Default priority
    });
  }

  // Sort by priority (descending) when showing priorities
  if (showPriority) {
    participants.sort((a, b) => b.priority - a.priority);
  }

  // Calculate all priorities for percentage calculation
  const allPriorities = participants.map(p => p.priority);
  const totalPriority = allPriorities.reduce((sum, p) => sum + p, 0);

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
      {/* Expected Distribution Header */}
      {showPriority && participants.length > 1 && (
        <div className="bg-[#F6F6F9] rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-[#6F71EE]/10 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-[#6F71EE]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <p className="font-medium text-[#101E57] text-sm">Expected Distribution</p>
              <p className="text-xs text-[#667085] mt-0.5">
                Adjust weights to control how bookings are distributed. Higher weight = more bookings.
              </p>
            </div>
          </div>

          {/* Distribution Preview Bar */}
          <div className="mt-4">
            <div className="flex h-3 rounded-full overflow-hidden">
              {participants.map((participant, index) => {
                const percentage = totalPriority > 0
                  ? (participant.priority / totalPriority) * 100
                  : 100 / participants.length;
                const colors = ['#6F71EE', '#417762', '#F59E0B', '#EC4899', '#8B5CF6'];
                return (
                  <div
                    key={participant.id}
                    style={{
                      width: `${percentage}%`,
                      backgroundColor: colors[index % colors.length]
                    }}
                    className="transition-all duration-300"
                    title={`${participant.name || participant.email}: ${Math.round(percentage)}%`}
                  />
                );
              })}
            </div>
            <div className="flex mt-2 gap-4 flex-wrap">
              {participants.map((participant, index) => {
                const percentage = totalPriority > 0
                  ? Math.round((participant.priority / totalPriority) * 100)
                  : Math.round(100 / participants.length);
                const colors = ['#6F71EE', '#417762', '#F59E0B', '#EC4899', '#8B5CF6'];
                return (
                  <div key={participant.id} className="flex items-center gap-1.5 text-xs">
                    <div
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: colors[index % colors.length] }}
                    />
                    <span className="text-[#667085]">
                      {participant.name?.split(' ')[0] || participant.email.split('@')[0]}
                    </span>
                    <span className="font-medium text-[#101E57]">{percentage}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

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
          const actualPercentage = hostStat?.percentage || 0;
          const expectedPercentage = totalPriority > 0
            ? Math.round((participant.priority / totalPriority) * 100)
            : Math.round(100 / participants.length);

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
                {/* Priority slider */}
                {showPriority && participant.hostRecordId && (
                  <PrioritySlider
                    hostRecordId={participant.hostRecordId}
                    currentPriority={participant.priority}
                    expectedPercentage={expectedPercentage}
                  />
                )}
                {showPriority && !participant.hostRecordId && (
                  <div className="text-xs text-[#667085] italic">
                    Add as host to set weight
                  </div>
                )}

                {/* Distribution stats */}
                {!showPriority && (
                  <div className="text-right min-w-[80px]">
                    <p className="text-sm font-medium text-[#101E57]">
                      {bookingCount} booking{bookingCount !== 1 ? 's' : ''}
                    </p>
                    {stats && stats.totalAssignments > 0 && (
                      <div className="flex items-center gap-2 mt-1">
                        <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#6F71EE] rounded-full"
                            style={{ width: `${actualPercentage}%` }}
                          />
                        </div>
                        <span className="text-xs text-[#667085]">{actualPercentage}%</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Info text */}
      <p className="text-xs text-[#667085]">
        {showPriority
          ? 'Adjust the weight slider to control booking distribution. Higher weight = more bookings assigned to that host.'
          : 'All hosts with "Host" role will receive bookings in rotation. Backup hosts are excluded from round-robin distribution.'
        }
      </p>
    </div>
  );
}

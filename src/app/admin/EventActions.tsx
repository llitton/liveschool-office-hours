'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface EventActionsProps {
  eventId: string;
  eventSlug: string;
}

export default function EventActions({ eventId, eventSlug }: EventActionsProps) {
  const router = useRouter();
  const [duplicating, setDuplicating] = useState(false);

  const handleDuplicate = async () => {
    if (duplicating) return;

    setDuplicating(true);
    try {
      const response = await fetch(`/api/events/${eventId}/duplicate`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to duplicate event');
      }

      const newEvent = await response.json();
      router.push(`/admin/events/${newEvent.id}`);
    } catch (error) {
      console.error('Error duplicating event:', error);
      alert('Failed to duplicate event. Please try again.');
    } finally {
      setDuplicating(false);
    }
  };

  return (
    <div className="flex gap-4">
      <Link
        href={`/admin/events/${eventId}`}
        className="text-[#6F71EE] hover:text-[#5a5cd0] text-sm font-medium"
      >
        Manage
      </Link>
      <button
        onClick={handleDuplicate}
        disabled={duplicating}
        className="text-[#F4B03D] hover:text-[#d99a2f] text-sm font-medium disabled:opacity-50"
      >
        {duplicating ? 'Duplicating...' : 'Duplicate'}
      </button>
      <a
        href={`/book/${eventSlug}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[#417762] hover:text-[#355f4f] text-sm font-medium"
      >
        View Public Page
      </a>
    </div>
  );
}

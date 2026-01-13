'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface EventActionsProps {
  eventId: string;
  eventSlug: string;
  eventName: string;
}

export default function EventActions({ eventId, eventSlug, eventName }: EventActionsProps) {
  const router = useRouter();
  const [duplicating, setDuplicating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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

  const handleDelete = async () => {
    if (deleting) return;

    setDeleting(true);
    try {
      const response = await fetch(`/api/events/${eventId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete event');
      }

      router.push('/admin');
      router.refresh();
    } catch (error) {
      console.error('Error deleting event:', error);
      alert('Failed to delete event. Please try again.');
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <>
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
        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="text-red-600 hover:text-red-700 text-sm font-medium"
        >
          Delete
        </button>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-[#101E57] mb-2">Delete Event</h3>
            <p className="text-[#667085] mb-4">
              Are you sure you want to delete <span className="font-medium text-[#101E57]">{eventName}</span>?
              This will also delete all associated time slots and bookings. This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition text-[#667085] font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-medium disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Delete Event'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

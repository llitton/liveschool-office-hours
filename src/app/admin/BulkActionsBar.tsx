'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface BulkActionsBarProps {
  selectedCount: number;
  selectedIds: string[];
  onClearSelection: () => void;
}

export default function BulkActionsBar({
  selectedCount,
  selectedIds,
  onClearSelection,
}: BulkActionsBarProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleBulkAction = async (action: 'disable' | 'enable' | 'duplicate') => {
    setLoading(action);
    try {
      const response = await fetch('/api/events/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, eventIds: selectedIds }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Action failed');
      }

      onClearSelection();
      router.refresh();
    } catch (error) {
      console.error('Bulk action error:', error);
      alert(error instanceof Error ? error.message : 'Action failed. Please try again.');
    } finally {
      setLoading(null);
    }
  };

  const handleDelete = async () => {
    setLoading('delete');
    try {
      const response = await fetch('/api/events/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', eventIds: selectedIds }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Delete failed');
      }

      onClearSelection();
      router.refresh();
    } catch (error) {
      console.error('Bulk delete error:', error);
      alert(error instanceof Error ? error.message : 'Delete failed. Please try again.');
    } finally {
      setLoading(null);
      setShowDeleteConfirm(false);
    }
  };

  if (selectedCount === 0) return null;

  return (
    <>
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#101E57] text-white rounded-xl shadow-xl px-4 py-3 flex items-center gap-4 z-40 animate-in fade-in slide-in-from-bottom-4 duration-200">
        <div className="flex items-center gap-2 pr-4 border-r border-white/20">
          <span className="bg-[#6F71EE] px-2 py-0.5 rounded font-semibold">
            {selectedCount}
          </span>
          <span className="text-sm">selected</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleBulkAction('disable')}
            disabled={loading !== null}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium
              hover:bg-white/10 transition disabled:opacity-50"
          >
            {loading === 'disable' ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
            )}
            Disable
          </button>

          <button
            onClick={() => handleBulkAction('enable')}
            disabled={loading !== null}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium
              hover:bg-white/10 transition disabled:opacity-50"
          >
            {loading === 'enable' ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            )}
            Enable
          </button>

          <button
            onClick={() => handleBulkAction('duplicate')}
            disabled={loading !== null}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium
              hover:bg-white/10 transition disabled:opacity-50"
          >
            {loading === 'duplicate' ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            )}
            Duplicate
          </button>

          <div className="w-px h-6 bg-white/20" />

          <button
            onClick={() => setShowDeleteConfirm(true)}
            disabled={loading !== null}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium
              text-red-300 hover:bg-red-500/20 transition disabled:opacity-50"
          >
            {loading === 'delete' ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            )}
            Delete
          </button>
        </div>

        <button
          onClick={onClearSelection}
          className="ml-2 p-1 hover:bg-white/10 rounded transition"
          title="Clear selection"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-[#101E57] mb-2">Delete {selectedCount} Event{selectedCount !== 1 ? 's' : ''}</h3>
            <p className="text-[#667085] mb-4">
              Are you sure you want to delete {selectedCount} event{selectedCount !== 1 ? 's' : ''}?
              This will also delete all associated time slots. Events with active bookings cannot be deleted.
              This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={loading === 'delete'}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition text-[#667085] font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={loading === 'delete'}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-medium disabled:opacity-50"
              >
                {loading === 'delete' ? 'Deleting...' : 'Delete Events'}
              </button>
            </div>
          </div>
        </div>
      )}

    </>
  );
}

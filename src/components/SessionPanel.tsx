'use client';

import { useState, useEffect } from 'react';

interface SessionTag {
  id: string;
  name: string;
  color: string;
}

interface QuickTask {
  id: string;
  title: string;
  notes: string | null;
  due_date: string | null;
  completed_at: string | null;
  hubspot_task_id: string | null;
}

interface SessionPanelProps {
  bookingId: string;
  attendeeName: string;
  attendeeEmail: string;
  onClose?: () => void;
}

export default function SessionPanel({
  bookingId,
  attendeeName,
  attendeeEmail,
  onClose,
}: SessionPanelProps) {
  const [allTags, setAllTags] = useState<SessionTag[]>([]);
  const [appliedTags, setAppliedTags] = useState<SessionTag[]>([]);
  const [tasks, setTasks] = useState<QuickTask[]>([]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingNotes, setSavingNotes] = useState(false);

  // New task form
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskNotes, setNewTaskNotes] = useState('');
  const [syncToHubSpot, setSyncToHubSpot] = useState(false);
  const [creatingTask, setCreatingTask] = useState(false);

  useEffect(() => {
    fetchData();
  }, [bookingId]);

  const fetchData = async () => {
    try {
      const [tagsRes, appliedTagsRes, tasksRes, notesRes] = await Promise.all([
        fetch('/api/session-tags'),
        fetch(`/api/bookings/${bookingId}/tags`),
        fetch(`/api/bookings/${bookingId}/tasks`),
        fetch(`/api/attendee-notes?email=${encodeURIComponent(attendeeEmail)}`),
      ]);

      if (tagsRes.ok) {
        const data = await tagsRes.json();
        setAllTags(data);
      }

      if (appliedTagsRes.ok) {
        const data = await appliedTagsRes.json();
        setAppliedTags(data);
      }

      if (tasksRes.ok) {
        const data = await tasksRes.json();
        setTasks(data);
      }

      if (notesRes.ok) {
        const data = await notesRes.json();
        if (data.notes) {
          setNotes(data.notes);
        }
      }
    } catch (err) {
      console.error('Failed to fetch session data:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleTag = async (tag: SessionTag) => {
    const isApplied = appliedTags.some((t) => t.id === tag.id);

    try {
      if (isApplied) {
        // Remove tag
        await fetch(`/api/bookings/${bookingId}/tags?tagId=${tag.id}`, {
          method: 'DELETE',
        });
        setAppliedTags(appliedTags.filter((t) => t.id !== tag.id));
      } else {
        // Add tag
        const response = await fetch(`/api/bookings/${bookingId}/tags`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tag_id: tag.id }),
        });
        if (response.ok) {
          setAppliedTags([...appliedTags, tag]);
        }
      }
    } catch (err) {
      console.error('Failed to toggle tag:', err);
    }
  };

  const saveNotes = async () => {
    setSavingNotes(true);
    try {
      await fetch('/api/attendee-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: attendeeEmail,
          notes,
        }),
      });
    } catch (err) {
      console.error('Failed to save notes:', err);
    } finally {
      setSavingNotes(false);
    }
  };

  const createTask = async () => {
    if (!newTaskTitle.trim()) return;

    setCreatingTask(true);
    try {
      const response = await fetch(`/api/bookings/${bookingId}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTaskTitle,
          notes: newTaskNotes || null,
          sync_to_hubspot: syncToHubSpot,
        }),
      });

      if (response.ok) {
        const task = await response.json();
        setTasks([task, ...tasks]);
        setNewTaskTitle('');
        setNewTaskNotes('');
        setSyncToHubSpot(false);
        setShowTaskForm(false);
      }
    } catch (err) {
      console.error('Failed to create task:', err);
    } finally {
      setCreatingTask(false);
    }
  };

  const toggleTaskComplete = async (task: QuickTask) => {
    try {
      const response = await fetch(`/api/bookings/${bookingId}/tasks`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task_id: task.id,
          completed: !task.completed_at,
        }),
      });

      if (response.ok) {
        const updatedTask = await response.json();
        setTasks(tasks.map((t) => (t.id === task.id ? updatedTask : t)));
      }
    } catch (err) {
      console.error('Failed to update task:', err);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-4">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          <div className="h-20 bg-gray-200 rounded"></div>
          <div className="h-4 bg-gray-200 rounded w-1/3"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="bg-[#6F71EE] text-white px-4 py-3 flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Session Panel</h3>
          <p className="text-sm text-white/80">{attendeeName}</p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      <div className="p-4 space-y-6">
        {/* Session Outcome Tags */}
        <div>
          <h4 className="text-sm font-medium text-[#101E57] mb-2">Session Outcome</h4>
          <div className="flex flex-wrap gap-2">
            {allTags.map((tag) => {
              const isApplied = appliedTags.some((t) => t.id === tag.id);
              return (
                <button
                  key={tag.id}
                  onClick={() => toggleTag(tag)}
                  className={`px-3 py-1 rounded-full text-sm font-medium transition ${
                    isApplied
                      ? 'text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                  style={isApplied ? { backgroundColor: tag.color } : {}}
                >
                  {tag.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Attendee Notes */}
        <div>
          <h4 className="text-sm font-medium text-[#101E57] mb-2">Attendee Notes</h4>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={saveNotes}
            placeholder="Add notes about this attendee..."
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57] text-sm resize-none"
          />
          {savingNotes && (
            <p className="text-xs text-[#667085] mt-1">Saving...</p>
          )}
        </div>

        {/* Quick Tasks */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-[#101E57]">Follow-up Tasks</h4>
            <button
              onClick={() => setShowTaskForm(!showTaskForm)}
              className="text-[#6F71EE] hover:text-[#5a5cd0] text-sm font-medium"
            >
              + Add Task
            </button>
          </div>

          {showTaskForm && (
            <div className="bg-[#F6F6F9] p-3 rounded-lg mb-3 space-y-2">
              <input
                type="text"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                placeholder="Task title..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57] text-sm"
              />
              <textarea
                value={newTaskNotes}
                onChange={(e) => setNewTaskNotes(e.target.value)}
                placeholder="Notes (optional)..."
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57] text-sm resize-none"
              />
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm text-[#667085]">
                  <input
                    type="checkbox"
                    checked={syncToHubSpot}
                    onChange={(e) => setSyncToHubSpot(e.target.checked)}
                    className="rounded border-gray-300 text-[#6F71EE] focus:ring-[#6F71EE]"
                  />
                  Sync to HubSpot
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowTaskForm(false)}
                    className="px-3 py-1 text-sm text-[#667085] hover:text-[#101E57]"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={createTask}
                    disabled={!newTaskTitle.trim() || creatingTask}
                    className="px-3 py-1 bg-[#6F71EE] text-white text-sm rounded-lg hover:bg-[#5a5cd0] disabled:opacity-50"
                  >
                    {creatingTask ? 'Creating...' : 'Create'}
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {tasks.length === 0 ? (
              <p className="text-sm text-[#667085] text-center py-2">No tasks yet</p>
            ) : (
              tasks.map((task) => (
                <div
                  key={task.id}
                  className={`flex items-start gap-2 p-2 rounded-lg ${
                    task.completed_at ? 'bg-gray-50' : 'bg-white border border-gray-200'
                  }`}
                >
                  <button
                    onClick={() => toggleTaskComplete(task)}
                    className={`mt-0.5 w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center ${
                      task.completed_at
                        ? 'bg-[#417762] border-[#417762] text-white'
                        : 'border-gray-300 hover:border-[#6F71EE]'
                    }`}
                  >
                    {task.completed_at && (
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-sm ${
                        task.completed_at ? 'text-[#667085] line-through' : 'text-[#101E57]'
                      }`}
                    >
                      {task.title}
                    </p>
                    {task.notes && (
                      <p className="text-xs text-[#667085] mt-0.5">{task.notes}</p>
                    )}
                    {task.hubspot_task_id && (
                      <span className="inline-block mt-1 px-2 py-0.5 bg-[#ff7a59]/10 text-[#ff7a59] text-xs rounded">
                        Synced to HubSpot
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

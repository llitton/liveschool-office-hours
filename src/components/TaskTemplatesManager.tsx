'use client';

import { useState, useEffect } from 'react';
import type { OHTaskTemplate, TaskTiming } from '@/types';
import { TASK_TIMING_LABELS } from '@/types';

interface TaskTemplatesManagerProps {
  eventId: string;
}

export default function TaskTemplatesManager({ eventId }: TaskTemplatesManagerProps) {
  const [templates, setTemplates] = useState<OHTaskTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state for new/edit template
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    timing: 'after_session' as TaskTiming,
    default_due_offset_hours: '',
    auto_create: false,
  });

  useEffect(() => {
    fetchTemplates();
  }, [eventId]);

  const fetchTemplates = async () => {
    try {
      const response = await fetch(`/api/events/${eventId}/task-templates`);
      if (response.ok) {
        const data = await response.json();
        setTemplates(data);
      }
    } catch (err) {
      console.error('Failed to fetch templates:', err);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      timing: 'after_session',
      default_due_offset_hours: '',
      auto_create: false,
    });
    setEditingId(null);
  };

  const handleEdit = (template: OHTaskTemplate) => {
    setEditingId(template.id);
    setFormData({
      title: template.title,
      description: template.description || '',
      timing: template.timing,
      default_due_offset_hours: template.default_due_offset_hours?.toString() || '',
      auto_create: template.auto_create,
    });
  };

  const handleSave = async () => {
    if (!formData.title.trim()) return;

    setSaving(true);
    try {
      const payload = {
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        timing: formData.timing,
        default_due_offset_hours: formData.default_due_offset_hours
          ? parseInt(formData.default_due_offset_hours)
          : null,
        auto_create: formData.auto_create,
      };

      if (editingId) {
        // Update existing
        const response = await fetch(`/api/events/${eventId}/task-templates`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ template_id: editingId, ...payload }),
        });

        if (response.ok) {
          const updated = await response.json();
          setTemplates(templates.map((t) => (t.id === editingId ? updated : t)));
          resetForm();
        }
      } else {
        // Create new
        const response = await fetch(`/api/events/${eventId}/task-templates`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (response.ok) {
          const created = await response.json();
          setTemplates([...templates, created]);
          resetForm();
        }
      }
    } catch (err) {
      console.error('Failed to save template:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (templateId: string) => {
    if (!confirm('Delete this task template?')) return;

    try {
      const response = await fetch(
        `/api/events/${eventId}/task-templates?templateId=${templateId}`,
        { method: 'DELETE' }
      );

      if (response.ok) {
        setTemplates(templates.filter((t) => t.id !== templateId));
        if (editingId === templateId) {
          resetForm();
        }
      }
    } catch (err) {
      console.error('Failed to delete template:', err);
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-1/3 mb-4" />
        <div className="h-20 bg-gray-100 rounded" />
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-[#101E57] mb-2">Task Templates</h2>
      <p className="text-sm text-[#667085] mb-4">
        Create reusable task checklists for session follow-ups. These can be quickly applied during wrap-up.
      </p>

      {/* Existing Templates */}
      {templates.length > 0 && (
        <div className="space-y-2 mb-4">
          {templates.map((template) => (
            <div
              key={template.id}
              className={`flex items-center justify-between p-3 rounded-lg border ${
                editingId === template.id
                  ? 'border-[#6F71EE] bg-[#6F71EE]/5'
                  : 'border-gray-200 bg-white'
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-[#101E57] truncate">
                    {template.title}
                  </span>
                  <span className="text-xs bg-gray-100 text-[#667085] px-2 py-0.5 rounded">
                    {TASK_TIMING_LABELS[template.timing]}
                  </span>
                  {template.auto_create && (
                    <span className="text-xs bg-[#6F71EE]/10 text-[#6F71EE] px-2 py-0.5 rounded">
                      Auto
                    </span>
                  )}
                </div>
                {template.description && (
                  <p className="text-sm text-[#667085] truncate mt-0.5">
                    {template.description}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 ml-4">
                <button
                  onClick={() => handleEdit(template)}
                  className="p-1.5 text-[#667085] hover:text-[#6F71EE] hover:bg-[#6F71EE]/10 rounded transition"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
                <button
                  onClick={() => handleDelete(template.id)}
                  className="p-1.5 text-[#667085] hover:text-red-600 hover:bg-red-50 rounded transition"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Form */}
      <div className="border border-gray-200 rounded-lg p-4 bg-[#F6F6F9]">
        <h3 className="font-medium text-[#101E57] mb-3">
          {editingId ? 'Edit Template' : 'Add New Template'}
        </h3>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-[#101E57] mb-1">
              Task Title
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g., Send follow-up email"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#101E57] mb-1">
              Description (Optional)
            </label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Additional notes or instructions"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-[#101E57] mb-1">
                Timing
              </label>
              <select
                value={formData.timing}
                onChange={(e) => setFormData({ ...formData, timing: e.target.value as TaskTiming })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57]"
              >
                <option value="before_session">Before Session</option>
                <option value="during_session">During Session</option>
                <option value="after_session">After Session</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#101E57] mb-1">
                Due After (hours)
              </label>
              <input
                type="number"
                value={formData.default_due_offset_hours}
                onChange={(e) => setFormData({ ...formData, default_due_offset_hours: e.target.value })}
                placeholder="e.g., 24"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57]"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.auto_create}
              onChange={(e) => setFormData({ ...formData, auto_create: e.target.checked })}
              className="w-4 h-4 text-[#6F71EE] border-gray-300 rounded focus:ring-[#6F71EE]"
            />
            <span className="text-sm text-[#101E57]">
              Auto-create for every booking
            </span>
          </label>

          <div className="flex gap-2 pt-2">
            <button
              onClick={handleSave}
              disabled={saving || !formData.title.trim()}
              className="px-4 py-2 bg-[#6F71EE] text-white rounded-lg hover:bg-[#5a5cd0] transition disabled:opacity-50 font-medium text-sm"
            >
              {saving ? 'Saving...' : editingId ? 'Update Template' : 'Add Template'}
            </button>
            {editingId && (
              <button
                onClick={resetForm}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition text-[#667085] font-medium text-sm"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>

      {templates.length === 0 && (
        <p className="text-sm text-[#667085] mt-4 text-center">
          No templates yet. Add common follow-up tasks above to save time during wrap-up.
        </p>
      )}
    </div>
  );
}

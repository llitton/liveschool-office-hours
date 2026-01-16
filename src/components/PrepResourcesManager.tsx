'use client';

import { useState, useEffect } from 'react';
import type { OHPrepResource } from '@/types';

interface PrepResourcesManagerProps {
  eventId: string;
}

export default function PrepResourcesManager({ eventId }: PrepResourcesManagerProps) {
  const [resources, setResources] = useState<OHPrepResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state for new/edit resource
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    link: '',
    keywords: '',
  });

  useEffect(() => {
    fetchResources();
  }, [eventId]);

  const fetchResources = async () => {
    try {
      const response = await fetch(`/api/events/${eventId}/resources`);
      if (response.ok) {
        const data = await response.json();
        setResources(data);
      }
    } catch (err) {
      console.error('Failed to fetch resources:', err);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      content: '',
      link: '',
      keywords: '',
    });
    setEditingId(null);
  };

  const handleEdit = (resource: OHPrepResource) => {
    setEditingId(resource.id);
    setFormData({
      title: resource.title,
      content: resource.content,
      link: resource.link || '',
      keywords: resource.keywords?.join(', ') || '',
    });
  };

  const handleSave = async () => {
    if (!formData.title.trim() || !formData.content.trim()) return;

    setSaving(true);
    try {
      const keywordsArray = formData.keywords
        .split(',')
        .map((k) => k.trim().toLowerCase())
        .filter((k) => k.length > 0);

      const payload = {
        title: formData.title.trim(),
        content: formData.content.trim(),
        link: formData.link.trim() || null,
        keywords: keywordsArray,
      };

      if (editingId) {
        // Update existing
        const response = await fetch(`/api/events/${eventId}/resources`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ resourceId: editingId, ...payload }),
        });

        if (response.ok) {
          const updated = await response.json();
          setResources(resources.map((r) => (r.id === editingId ? updated : r)));
          resetForm();
        }
      } else {
        // Create new
        const response = await fetch(`/api/events/${eventId}/resources`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (response.ok) {
          const created = await response.json();
          setResources([created, ...resources]);
          resetForm();
        }
      }
    } catch (err) {
      console.error('Failed to save resource:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (resourceId: string) => {
    if (!confirm('Delete this resource? It will no longer be available to send to attendees.')) return;

    try {
      const response = await fetch(
        `/api/events/${eventId}/resources?resourceId=${resourceId}`,
        { method: 'DELETE' }
      );

      if (response.ok) {
        setResources(resources.filter((r) => r.id !== resourceId));
        if (editingId === resourceId) {
          resetForm();
        }
      }
    } catch (err) {
      console.error('Failed to delete resource:', err);
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
      <h2 className="text-lg font-semibold text-[#101E57] mb-2">Prep Resources</h2>
      <p className="text-sm text-[#667085] mb-4">
        Create help articles that can be automatically matched to attendees based on their question responses,
        or manually sent during sessions. Add keywords to improve matching.
      </p>

      {/* Existing Resources */}
      {resources.length > 0 && (
        <div className="space-y-3 mb-4">
          {resources.map((resource) => (
            <div
              key={resource.id}
              className={`p-4 rounded-lg border ${
                editingId === resource.id
                  ? 'border-[#6F71EE] bg-[#6F71EE]/5'
                  : 'border-gray-200 bg-white'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-[#101E57]">{resource.title}</span>
                    {resource.link && (
                      <a
                        href={resource.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#6F71EE] hover:underline text-xs"
                      >
                        View link ↗
                      </a>
                    )}
                  </div>
                  <p className="text-sm text-[#667085] line-clamp-2 mb-2">{resource.content}</p>
                  {resource.keywords && resource.keywords.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {resource.keywords.map((keyword, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 bg-[#6F71EE]/10 text-[#6F71EE] text-xs rounded-full"
                        >
                          {keyword}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={() => handleEdit(resource)}
                    className="p-1.5 text-[#667085] hover:text-[#6F71EE] hover:bg-[#6F71EE]/10 rounded transition"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDelete(resource.id)}
                    className="p-1.5 text-[#667085] hover:text-red-600 hover:bg-red-50 rounded transition"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Form */}
      <div className="border border-gray-200 rounded-lg p-4 bg-[#F6F6F9]">
        <h3 className="font-medium text-[#101E57] mb-3">
          {editingId ? 'Edit Resource' : 'Add New Resource'}
        </h3>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-[#101E57] mb-1">
              Title
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g., Getting Started Guide"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#101E57] mb-1">
              Content
            </label>
            <textarea
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              placeholder="Brief description of what this resource covers..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#101E57] mb-1">
              Link (Optional)
            </label>
            <input
              type="url"
              value={formData.link}
              onChange={(e) => setFormData({ ...formData, link: e.target.value })}
              placeholder="https://help.liveschool.net/article/..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#101E57] mb-1">
              Keywords (comma-separated)
            </label>
            <input
              type="text"
              value={formData.keywords}
              onChange={(e) => setFormData({ ...formData, keywords: e.target.value })}
              placeholder="e.g., setup, onboarding, getting started, new user"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57]"
            />
            <p className="text-xs text-[#667085] mt-1">
              Keywords help auto-match this resource to attendees based on their question responses.
            </p>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              onClick={handleSave}
              disabled={saving || !formData.title.trim() || !formData.content.trim()}
              className="px-4 py-2 bg-[#6F71EE] text-white rounded-lg hover:bg-[#5a5cd0] transition disabled:opacity-50 font-medium text-sm"
            >
              {saving ? 'Saving...' : editingId ? 'Update Resource' : 'Add Resource'}
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

      {resources.length === 0 && (
        <p className="text-sm text-[#667085] mt-4 text-center">
          No resources yet. Add help articles above to share with attendees during or after sessions.
        </p>
      )}
    </div>
  );
}

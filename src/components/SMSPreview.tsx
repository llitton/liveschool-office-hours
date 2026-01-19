'use client';

import { useState, useEffect } from 'react';

interface SMSPreviewProps {
  template: string;
  eventId?: string;
  showPhoneMockup?: boolean;
}

interface PreviewResponse {
  preview: string;
  characterCount: number;
  segmentCount: number;
  encoding: 'gsm' | 'unicode';
  maxCharacters: number;
  warnings: string[];
}

export function SMSPreview({ template, eventId, showPhoneMockup = true }: SMSPreviewProps) {
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchPreview = async () => {
      if (!template.trim()) {
        setPreview(null);
        return;
      }

      setLoading(true);
      try {
        const response = await fetch('/api/sms/preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ template, eventId }),
        });

        if (response.ok) {
          const data = await response.json();
          setPreview(data);
        }
      } catch (err) {
        console.error('Failed to fetch preview:', err);
      } finally {
        setLoading(false);
      }
    };

    // Debounce the preview fetch
    const timeout = setTimeout(fetchPreview, 300);
    return () => clearTimeout(timeout);
  }, [template, eventId]);

  if (!template.trim() && !loading) {
    return null;
  }

  const characterCount = preview?.characterCount || template.length;
  const maxChars = preview?.maxCharacters || 160;
  const segmentCount = preview?.segmentCount || 1;
  const isNearLimit = characterCount > maxChars * 0.9;
  const isOverLimit = characterCount > maxChars;

  return (
    <div className="bg-[#F6F6F9] rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm font-medium text-[#101E57]">Preview</span>
        {loading && (
          <span className="text-xs text-[#667085]">Loading...</span>
        )}
      </div>

      {showPhoneMockup ? (
        // Phone mockup style
        <div className="max-w-[280px] mx-auto">
          {/* Phone frame */}
          <div className="bg-[#1a1a1a] rounded-[24px] p-2">
            {/* Screen */}
            <div className="bg-white rounded-[16px] min-h-[120px] p-3">
              {/* Message bubble */}
              <div className="bg-[#E5E5EA] rounded-2xl rounded-bl-sm px-3 py-2 text-sm text-[#101E57] max-w-[200px]">
                {preview?.preview || template || 'Enter a message...'}
              </div>
            </div>
          </div>
        </div>
      ) : (
        // Simple text preview
        <div className="bg-white rounded-lg p-3 border border-gray-200">
          <p className="text-sm text-[#101E57] whitespace-pre-wrap">
            {preview?.preview || template || 'Enter a message...'}
          </p>
        </div>
      )}

      {/* Character count and segment info */}
      <div className="flex items-center justify-between mt-3">
        <span className={`text-xs ${
          isOverLimit ? 'text-red-600 font-medium' :
          isNearLimit ? 'text-amber-600' :
          'text-[#667085]'
        }`}>
          {characterCount}/{maxChars} characters
          {preview?.encoding === 'unicode' && ' (Unicode)'}
        </span>
        <span className={`text-xs ${segmentCount > 1 ? 'text-amber-600' : 'text-[#667085]'}`}>
          {segmentCount} SMS{segmentCount > 1 ? 's' : ''}
        </span>
      </div>

      {/* Warnings */}
      {preview?.warnings && preview.warnings.length > 0 && (
        <div className="mt-3 space-y-1">
          {preview.warnings.map((warning, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-amber-600">
              <svg className="w-3 h-3 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span>{warning}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

'use client';

import { useState } from 'react';

interface CustomQuestion {
  id: string;
  question: string;
  type: 'text' | 'textarea' | 'select';
  required: boolean;
  options?: string[];
}

interface BookingPagePreviewProps {
  eventName: string;
  eventDescription: string;
  hostName?: string;
  duration: number;
  customQuestions: CustomQuestion[];
  meetingType: string;
  bannerImage?: string;
}

export default function BookingPagePreview({
  eventName,
  eventDescription,
  hostName,
  duration,
  customQuestions,
  meetingType,
  bannerImage
}: BookingPagePreviewProps) {
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
      {/* Preview Header */}
      <div className="px-4 py-3 bg-[#F6F6F9] border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
            <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
          </div>
          <span className="text-xs text-[#667085] ml-2">Live Preview</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowForm(!showForm)}
            className="text-xs px-2 py-1 rounded bg-white border border-gray-200 text-[#667085] hover:text-[#101E57] transition"
          >
            {showForm ? 'Show Calendar' : 'Show Form'}
          </button>
        </div>
      </div>

      {/* Preview Content - Scaled down booking page */}
      <div className="p-4 max-h-[500px] overflow-y-auto" style={{ transform: 'scale(0.9)', transformOrigin: 'top left', width: '111.11%' }}>
        {/* Banner */}
        {bannerImage && (
          <div className="w-full h-20 rounded-lg overflow-hidden mb-4 bg-gray-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={bannerImage}
              alt="Banner"
              className="w-full h-full object-cover"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          </div>
        )}

        {/* Event Header */}
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-[#101E57] leading-tight">
            {eventName || 'Event Name'}
          </h3>
          {meetingType !== 'round_robin' && hostName && (
            <p className="text-sm text-[#667085] mt-1">with {hostName}</p>
          )}
          {meetingType === 'round_robin' && (
            <p className="text-sm text-[#667085] mt-1">with available team member</p>
          )}
          <div className="flex items-center gap-3 mt-2 text-sm text-[#667085]">
            <span className="flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {duration} min
            </span>
            <span className="flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Google Meet
            </span>
          </div>
        </div>

        {/* Description */}
        {eventDescription && (
          <div className="mb-4 text-sm text-[#667085] line-clamp-3" dangerouslySetInnerHTML={{ __html: eventDescription }} />
        )}

        {!showForm ? (
          /* Calendar Preview */
          <div className="border border-gray-200 rounded-lg p-3">
            <div className="flex items-center justify-between mb-3">
              <button className="text-[#667085]">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <span className="text-sm font-medium text-[#101E57]">January 2026</span>
              <button className="text-[#667085]">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            {/* Mini Calendar Grid */}
            <div className="grid grid-cols-7 gap-1 text-center text-xs">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                <div key={i} className="text-[#667085] py-1">{day}</div>
              ))}
              {Array.from({ length: 31 }, (_, i) => (
                <div
                  key={i}
                  className={`py-1 rounded ${
                    i === 19 ? 'bg-[#6F71EE] text-white' :
                    [20, 21, 22, 23, 24].includes(i) ? 'text-[#101E57] hover:bg-[#F6F6F9] cursor-pointer' :
                    'text-gray-300'
                  }`}
                >
                  {i + 1}
                </div>
              ))}
            </div>

            {/* Time Slots */}
            <div className="mt-3 pt-3 border-t border-gray-200">
              <p className="text-xs text-[#667085] mb-2">Mon, Jan 20</p>
              <div className="grid grid-cols-3 gap-1">
                {['9:00 AM', '9:30 AM', '10:00 AM', '10:30 AM', '11:00 AM', '2:00 PM'].map((time, i) => (
                  <button
                    key={i}
                    className={`text-xs py-1.5 rounded border transition ${
                      i === 0
                        ? 'border-[#6F71EE] bg-[#6F71EE] text-white'
                        : 'border-gray-200 text-[#101E57] hover:border-[#6F71EE]'
                    }`}
                  >
                    {time}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Form Preview */
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-[#101E57] mb-1">Name *</label>
              <input
                type="text"
                placeholder="Your name"
                className="w-full px-2.5 py-1.5 border border-gray-200 rounded text-sm"
                disabled
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#101E57] mb-1">Email *</label>
              <input
                type="email"
                placeholder="you@example.com"
                className="w-full px-2.5 py-1.5 border border-gray-200 rounded text-sm"
                disabled
              />
            </div>

            {/* Custom Questions */}
            {customQuestions.slice(0, 3).map((q, i) => (
              <div key={q.id || i}>
                <label className="block text-xs font-medium text-[#101E57] mb-1">
                  {q.question || 'Custom question'} {q.required && '*'}
                </label>
                {q.type === 'textarea' ? (
                  <textarea
                    placeholder="Your answer..."
                    rows={2}
                    className="w-full px-2.5 py-1.5 border border-gray-200 rounded text-sm resize-none"
                    disabled
                  />
                ) : q.type === 'select' ? (
                  <select className="w-full px-2.5 py-1.5 border border-gray-200 rounded text-sm" disabled>
                    <option>Select an option</option>
                    {q.options?.map((opt, j) => (
                      <option key={j}>{opt}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    placeholder="Your answer..."
                    className="w-full px-2.5 py-1.5 border border-gray-200 rounded text-sm"
                    disabled
                  />
                )}
              </div>
            ))}

            {customQuestions.length > 3 && (
              <p className="text-xs text-[#667085]">+{customQuestions.length - 3} more questions</p>
            )}

            <button className="w-full bg-[#6F71EE] text-white py-2 rounded text-sm font-medium mt-2">
              Confirm Booking
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

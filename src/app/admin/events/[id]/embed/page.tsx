'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import type { OHEvent } from '@/types';
import Breadcrumb from '@/components/Breadcrumb';

export default function EventEmbedPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [event, setEvent] = useState<OHEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  // Embed options
  const [hideHeader, setHideHeader] = useState(false);
  const [hideBranding, setHideBranding] = useState(false);
  const [buttonText, setButtonText] = useState('Book a Session');
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop');

  // Get the base URL for embeds - use NEXT_PUBLIC_APP_URL for SSR, window.location.origin for client
  const baseUrl = typeof window !== 'undefined'
    ? window.location.origin
    : process.env.NEXT_PUBLIC_APP_URL || '';

  useEffect(() => {
    fetchEvent();
  }, [id]);

  const fetchEvent = async () => {
    try {
      const response = await fetch(`/api/events/${id}`);
      if (!response.ok) throw new Error('Event not found');
      const eventData = await response.json();
      setEvent(eventData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load event');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      console.error('Failed to copy to clipboard');
    }
  };

  const buildEmbedOptions = () => {
    const opts: string[] = [`slug: '${event?.slug}'`];
    if (hideHeader) opts.push('hideHeader: true');
    if (hideBranding) opts.push('hideBranding: true');
    return opts.join(',\n    ');
  };

  const getInlineCode = () => {
    return `<!-- LiveSchool Booking Widget -->
<div id="liveschool-booking"></div>
<script src="${baseUrl}/embed/liveschool-embed.js"></script>
<script>
  LiveSchool.inline('liveschool-booking', {
    ${buildEmbedOptions()}
  });
</script>`;
  };

  const getPopupCode = () => {
    return `<!-- LiveSchool Booking Button -->
<script src="${baseUrl}/embed/liveschool-embed.js"></script>
<button onclick="LiveSchool.popup({
    ${buildEmbedOptions()}
  })" style="background:#6F71EE;color:white;padding:12px 24px;border:none;border-radius:8px;cursor:pointer;font-size:16px;font-weight:500;">
  ${buttonText}
</button>`;
  };

  const getDataAttributeInlineCode = () => {
    let attrs = `data-liveschool-inline="${event?.slug}"`;
    if (hideHeader) attrs += '\n  data-hide-header="true"';
    if (hideBranding) attrs += '\n  data-hide-branding="true"';
    return `<!-- LiveSchool Booking Widget (Auto-Init) -->
<div id="liveschool-booking"
  ${attrs}></div>
<script src="${baseUrl}/embed/liveschool-embed.js"></script>`;
  };

  const getDataAttributePopupCode = () => {
    let attrs = `data-liveschool-popup="${event?.slug}"`;
    if (hideHeader) attrs += '\n  data-hide-header="true"';
    if (hideBranding) attrs += '\n  data-hide-branding="true"';
    return `<!-- LiveSchool Booking Button (Auto-Init) -->
<script src="${baseUrl}/embed/liveschool-embed.js"></script>
<button ${attrs}
  style="background:#6F71EE;color:white;padding:12px 24px;border:none;border-radius:8px;cursor:pointer;font-size:16px;font-weight:500;">
  ${buttonText}
</button>`;
  };

  const getDirectLink = () => {
    return `${baseUrl}/book/${event?.slug}`;
  };

  const getPreviewUrl = () => {
    const params = new URLSearchParams();
    params.set('parentOrigin', baseUrl);
    if (hideHeader) params.set('hideHeader', 'true');
    if (hideBranding) params.set('hideBranding', 'true');
    return `${baseUrl}/embed/${event?.slug}?${params.toString()}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F6F6F9] flex items-center justify-center">
        <p className="text-[#667085]">Loading...</p>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-[#F6F6F9] flex items-center justify-center">
        <p className="text-[#667085]">Event not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F6F6F9]">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
          <Image
            src="https://info.whyliveschool.com/hubfs/Brand/liveschool-logo.png"
            alt="LiveSchool"
            width={120}
            height={32}
          />
          <Breadcrumb
            items={[
              { label: 'Dashboard', href: '/admin' },
              { label: event.name, href: `/admin/events/${id}` },
              { label: 'Embed' },
            ]}
          />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-semibold text-[#101E57] mb-2">Embed on Your Website</h1>
        <p className="text-[#667085] mb-6">
          Add the booking widget to any website with a simple copy-paste code snippet.
        </p>

        {error && (
          <div className="bg-red-50 text-red-700 p-4 rounded mb-6 text-sm">{error}</div>
        )}

        {/* Embed Options */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <h2 className="text-lg font-semibold text-[#101E57] mb-4">Customization Options</h2>

          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={hideHeader}
                onChange={(e) => setHideHeader(e.target.checked)}
                className="w-4 h-4 text-[#6F71EE] border-gray-300 rounded focus:ring-[#6F71EE]"
              />
              <span className="text-sm text-[#101E57]">Hide Header</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={hideBranding}
                onChange={(e) => setHideBranding(e.target.checked)}
                className="w-4 h-4 text-[#6F71EE] border-gray-300 rounded focus:ring-[#6F71EE]"
              />
              <span className="text-sm text-[#101E57]">Hide Branding</span>
            </label>
          </div>
        </div>

        {/* Direct Link */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <h2 className="text-lg font-semibold text-[#101E57] mb-2">Direct Link</h2>
          <p className="text-sm text-[#667085] mb-4">
            Share this link directly or use it in emails and social media.
          </p>

          <div className="flex items-center gap-3">
            <input
              type="text"
              value={getDirectLink()}
              readOnly
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-[#101E57] font-mono text-sm"
            />
            <button
              onClick={() => copyToClipboard(getDirectLink(), 'link')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                copied === 'link'
                  ? 'bg-green-500 text-white'
                  : 'bg-[#6F71EE] text-white hover:bg-[#5a5cd0]'
              }`}
            >
              {copied === 'link' ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>

        {/* Inline Embed */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <h2 className="text-lg font-semibold text-[#101E57] mb-2">Inline Embed</h2>
          <p className="text-sm text-[#667085] mb-4">
            Embed the booking widget directly on your page. The widget will appear wherever you place this code.
          </p>

          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-[#101E57]">JavaScript API</span>
              <button
                onClick={() => copyToClipboard(getInlineCode(), 'inline')}
                className={`px-3 py-1 text-sm rounded font-medium transition ${
                  copied === 'inline'
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-100 text-[#667085] hover:bg-gray-200'
                }`}
              >
                {copied === 'inline' ? 'Copied!' : 'Copy Code'}
              </button>
            </div>
            <pre className="bg-[#F6F6F9] p-4 rounded-lg overflow-x-auto text-sm">
              <code className="text-[#101E57]">{getInlineCode()}</code>
            </pre>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-[#101E57]">Data Attributes (No JS Required)</span>
              <button
                onClick={() => copyToClipboard(getDataAttributeInlineCode(), 'inline-data')}
                className={`px-3 py-1 text-sm rounded font-medium transition ${
                  copied === 'inline-data'
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-100 text-[#667085] hover:bg-gray-200'
                }`}
              >
                {copied === 'inline-data' ? 'Copied!' : 'Copy Code'}
              </button>
            </div>
            <pre className="bg-[#F6F6F9] p-4 rounded-lg overflow-x-auto text-sm">
              <code className="text-[#101E57]">{getDataAttributeInlineCode()}</code>
            </pre>
          </div>
        </div>

        {/* Popup Button */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <h2 className="text-lg font-semibold text-[#101E57] mb-2">Popup Button</h2>
          <p className="text-sm text-[#667085] mb-4">
            Add a button that opens the booking form in a modal overlay.
          </p>

          <div className="mb-4">
            <label className="block text-sm font-medium text-[#101E57] mb-1">
              Button Text
            </label>
            <input
              type="text"
              value={buttonText}
              onChange={(e) => setButtonText(e.target.value)}
              className="w-64 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57]"
            />
          </div>

          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-[#101E57]">JavaScript API</span>
              <button
                onClick={() => copyToClipboard(getPopupCode(), 'popup')}
                className={`px-3 py-1 text-sm rounded font-medium transition ${
                  copied === 'popup'
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-100 text-[#667085] hover:bg-gray-200'
                }`}
              >
                {copied === 'popup' ? 'Copied!' : 'Copy Code'}
              </button>
            </div>
            <pre className="bg-[#F6F6F9] p-4 rounded-lg overflow-x-auto text-sm">
              <code className="text-[#101E57]">{getPopupCode()}</code>
            </pre>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-[#101E57]">Data Attributes (No JS Required)</span>
              <button
                onClick={() => copyToClipboard(getDataAttributePopupCode(), 'popup-data')}
                className={`px-3 py-1 text-sm rounded font-medium transition ${
                  copied === 'popup-data'
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-100 text-[#667085] hover:bg-gray-200'
                }`}
              >
                {copied === 'popup-data' ? 'Copied!' : 'Copy Code'}
              </button>
            </div>
            <pre className="bg-[#F6F6F9] p-4 rounded-lg overflow-x-auto text-sm">
              <code className="text-[#101E57]">{getDataAttributePopupCode()}</code>
            </pre>
          </div>
        </div>

        {/* Live Preview */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-[#101E57]">Live Preview</h2>
              <p className="text-sm text-[#667085]">
                See how the embed will look on your website.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPreviewMode('desktop')}
                className={`px-3 py-1 text-sm rounded font-medium transition ${
                  previewMode === 'desktop'
                    ? 'bg-[#6F71EE] text-white'
                    : 'bg-gray-100 text-[#667085] hover:bg-gray-200'
                }`}
              >
                Desktop
              </button>
              <button
                onClick={() => setPreviewMode('mobile')}
                className={`px-3 py-1 text-sm rounded font-medium transition ${
                  previewMode === 'mobile'
                    ? 'bg-[#6F71EE] text-white'
                    : 'bg-gray-100 text-[#667085] hover:bg-gray-200'
                }`}
              >
                Mobile
              </button>
            </div>
          </div>

          <div
            className={`bg-[#F6F6F9] rounded-lg p-4 mx-auto transition-all ${
              previewMode === 'mobile' ? 'max-w-[375px]' : 'w-full'
            }`}
          >
            <iframe
              src={getPreviewUrl()}
              className="w-full border-0 rounded-lg bg-white"
              style={{ minHeight: '500px' }}
              title="Embed Preview"
            />
          </div>
        </div>

        {/* JavaScript Events */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <h2 className="text-lg font-semibold text-[#101E57] mb-2">JavaScript Events</h2>
          <p className="text-sm text-[#667085] mb-4">
            Listen for events to integrate with your website&apos;s functionality.
          </p>

          <pre className="bg-[#F6F6F9] p-4 rounded-lg overflow-x-auto text-sm">
            <code className="text-[#101E57]">{`// Listen for booking completion
LiveSchool.on('bookingComplete', function(data) {
  console.log('Booking completed!', data);
  // data.bookingId - unique booking ID
  // data.eventName - name of the event
  // data.slotTime - booked time slot
  // data.attendeeEmail - attendee's email
});

// Or pass callbacks directly
LiveSchool.inline('liveschool-booking', {
  slug: '${event.slug}',
  onBookingComplete: function(data) {
    // Track conversion, show thank you message, etc.
    console.log('Booking completed!', data);
  }
});`}</code>
          </pre>
        </div>

        {/* Back Button */}
        <Link
          href={`/admin/events/${id}`}
          className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition text-[#667085] font-medium"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Event
        </Link>
      </main>
    </div>
  );
}

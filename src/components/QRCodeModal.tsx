'use client';

import { useState, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';

interface QRCodeModalProps {
  url: string;
  title: string;
  onClose: () => void;
}

export default function QRCodeModal({ url, title, onClose }: QRCodeModalProps) {
  const [size, setSize] = useState(256);
  const [includeTitle, setIncludeTitle] = useState(true);
  const qrRef = useRef<HTMLDivElement>(null);

  const downloadQRCode = (format: 'png' | 'svg') => {
    if (!qrRef.current) return;

    const svg = qrRef.current.querySelector('svg');
    if (!svg) return;

    if (format === 'svg') {
      // Download as SVG
      const svgData = new XMLSerializer().serializeToString(svg);
      const blob = new Blob([svgData], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title.replace(/\s+/g, '-').toLowerCase()}-qr.svg`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      // Download as PNG
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const padding = 32;
      const titleHeight = includeTitle ? 48 : 0;
      const urlHeight = 24;
      const totalHeight = size + padding * 2 + titleHeight + urlHeight;
      const totalWidth = size + padding * 2;

      canvas.width = totalWidth;
      canvas.height = totalHeight;

      // White background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, totalWidth, totalHeight);

      // Draw title
      if (includeTitle) {
        ctx.fillStyle = '#101E57';
        ctx.font = 'bold 18px system-ui, -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(title, totalWidth / 2, padding + 20, totalWidth - padding);
      }

      // Draw QR code
      const img = new Image();
      const svgData = new XMLSerializer().serializeToString(svg);
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const svgUrl = URL.createObjectURL(svgBlob);

      img.onload = () => {
        ctx.drawImage(img, padding, padding + titleHeight, size, size);

        // Draw URL below QR code
        ctx.fillStyle = '#667085';
        ctx.font = '12px system-ui, -apple-system, sans-serif';
        ctx.textAlign = 'center';
        const displayUrl = url.replace('https://', '').replace('http://', '');
        ctx.fillText(displayUrl, totalWidth / 2, totalHeight - padding / 2, totalWidth - padding);

        // Download
        const pngUrl = canvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = pngUrl;
        a.download = `${title.replace(/\s+/g, '-').toLowerCase()}-qr.png`;
        a.click();

        URL.revokeObjectURL(svgUrl);
      };

      img.src = svgUrl;
    }
  };

  const copyUrl = () => {
    navigator.clipboard.writeText(url);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-[#101E57]">QR Code</h3>
          <button
            onClick={onClose}
            className="text-[#667085] hover:text-[#101E57] transition"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* QR Code Preview */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6" ref={qrRef}>
          <div className="flex flex-col items-center">
            {includeTitle && (
              <h4 className="text-lg font-semibold text-[#101E57] mb-4 text-center">{title}</h4>
            )}
            <QRCodeSVG
              value={url}
              size={size}
              level="M"
              includeMargin={false}
              fgColor="#101E57"
            />
            <p className="text-xs text-[#667085] mt-4 text-center break-all">
              {url.replace('https://', '').replace('http://', '')}
            </p>
          </div>
        </div>

        {/* Options */}
        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-[#101E57] mb-2">Size</label>
            <div className="flex gap-2">
              {[128, 256, 512].map((s) => (
                <button
                  key={s}
                  onClick={() => setSize(s)}
                  className={`px-3 py-1.5 text-sm rounded-lg transition ${
                    size === s
                      ? 'bg-[#6F71EE] text-white'
                      : 'bg-gray-100 text-[#667085] hover:bg-gray-200'
                  }`}
                >
                  {s}px
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={includeTitle}
              onChange={(e) => setIncludeTitle(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-[#6F71EE] focus:ring-[#6F71EE]"
            />
            <span className="text-sm text-[#101E57]">Include title in download</span>
          </label>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => downloadQRCode('png')}
            className="flex-1 px-4 py-2 bg-[#6F71EE] text-white rounded-lg hover:bg-[#5a5cd0] transition font-medium flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            PNG
          </button>
          <button
            onClick={() => downloadQRCode('svg')}
            className="flex-1 px-4 py-2 bg-white border border-gray-300 text-[#101E57] rounded-lg hover:bg-gray-50 transition font-medium flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            SVG
          </button>
          <button
            onClick={copyUrl}
            className="px-4 py-2 bg-white border border-gray-300 text-[#101E57] rounded-lg hover:bg-gray-50 transition font-medium flex items-center justify-center gap-2"
            title="Copy URL"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </button>
        </div>

        <p className="text-xs text-[#667085] text-center mt-4">
          Scan to open the booking page
        </p>
      </div>
    </div>
  );
}

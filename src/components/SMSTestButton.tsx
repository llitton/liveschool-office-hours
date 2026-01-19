'use client';

import { useState } from 'react';

interface SMSTestButtonProps {
  eventId?: string;
  templateType?: '24h' | '1h';
  disabled?: boolean;
  className?: string;
}

export function SMSTestButton({
  eventId,
  templateType = '24h',
  disabled = false,
  className = '',
}: SMSTestButtonProps) {
  const [showModal, setShowModal] = useState(false);
  const [phone, setPhone] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleSendTest = async () => {
    if (!phone.trim()) {
      setResult({ success: false, message: 'Please enter a phone number' });
      return;
    }

    setSending(true);
    setResult(null);

    try {
      const response = await fetch('/api/sms/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: phone.trim(),
          eventId,
          templateType,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setResult({ success: true, message: 'Test SMS sent! Check your phone.' });
        setPhone('');
        // Close modal after success
        setTimeout(() => {
          setShowModal(false);
          setResult(null);
        }, 2000);
      } else {
        setResult({ success: false, message: data.error || 'Failed to send test SMS' });
      }
    } catch (err) {
      setResult({ success: false, message: 'Failed to send test SMS' });
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setShowModal(true)}
        disabled={disabled}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-[#6F71EE] bg-[#6F71EE]/10 rounded-lg hover:bg-[#6F71EE]/20 transition disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
        </svg>
        Send Test SMS
      </button>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowModal(false)}
          />

          {/* Modal content */}
          <div className="relative bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
            <h3 className="text-lg font-semibold text-[#101E57] mb-2">
              Send Test SMS
            </h3>
            <p className="text-sm text-[#667085] mb-4">
              Enter your phone number to receive a test message using the {templateType === '24h' ? '24-hour' : '1-hour'} reminder template.
            </p>

            <div className="mb-4">
              <label className="block text-sm font-medium text-[#101E57] mb-1">
                Phone Number
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 555 123 4567"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6F71EE] focus:border-[#6F71EE] text-[#101E57]"
                autoFocus
              />
              <p className="text-xs text-[#667085] mt-1">
                Include country code for international numbers
              </p>
            </div>

            {result && (
              <div className={`mb-4 p-3 rounded-lg text-sm ${
                result.success
                  ? 'bg-green-50 text-green-700'
                  : 'bg-red-50 text-red-700'
              }`}>
                {result.message}
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleSendTest}
                disabled={sending || !phone.trim()}
                className="flex-1 bg-[#6F71EE] text-white px-4 py-2 rounded-lg hover:bg-[#5a5cd0] transition disabled:opacity-50 font-medium text-sm"
              >
                {sending ? 'Sending...' : 'Send Test'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowModal(false);
                  setResult(null);
                }}
                className="px-4 py-2 text-[#667085] hover:text-[#101E57] text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

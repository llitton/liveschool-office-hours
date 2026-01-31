'use client';

import { useState } from 'react';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type FeedbackCategory = 'bug' | 'suggestion' | 'question';

export default function FeedbackModal({ isOpen, onClose }: FeedbackModalProps) {
  const [category, setCategory] = useState<FeedbackCategory>('suggestion');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!message.trim()) {
      setError('Please enter a message');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const response = await fetch('/api/user-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          message,
          pageUrl: window.location.pathname,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to submit feedback');
      }

      setIsSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit feedback');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    // Reset state when closing
    setCategory('suggestion');
    setMessage('');
    setIsSubmitted(false);
    setError('');
    onClose();
  };

  const categories: { value: FeedbackCategory; label: string; icon: string }[] = [
    { value: 'bug', label: 'Bug', icon: '🐛' },
    { value: 'suggestion', label: 'Suggestion', icon: '💡' },
    { value: 'question', label: 'Question', icon: '❓' },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-[#101E57]">
            {isSubmitted ? 'Thanks!' : 'Send Feedback'}
          </h3>
          <button
            onClick={handleClose}
            className="text-[#667085] hover:text-[#101E57] transition p-1"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {isSubmitted ? (
          // Success state
          <div className="text-center py-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-[#667085] mb-6">
              Your feedback has been submitted. We&apos;ll take a look!
            </p>
            <button
              onClick={handleClose}
              className="bg-[#6F71EE] text-white px-6 py-2 rounded-lg hover:bg-[#5a5cd0] transition font-medium"
            >
              Done
            </button>
          </div>
        ) : (
          // Form
          <form onSubmit={handleSubmit}>
            {/* Category selector */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-[#344054] mb-2">
                What type of feedback?
              </label>
              <div className="flex gap-2">
                {categories.map((cat) => (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => setCategory(cat.value)}
                    className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition ${
                      category === cat.value
                        ? 'border-[#6F71EE] bg-[#6F71EE]/5 text-[#6F71EE]'
                        : 'border-gray-200 text-[#667085] hover:border-gray-300'
                    }`}
                  >
                    <span className="mr-1">{cat.icon}</span>
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Message textarea */}
            <div className="mb-4">
              <label htmlFor="feedback-message" className="block text-sm font-medium text-[#344054] mb-2">
                {category === 'bug' ? 'What went wrong?' : category === 'question' ? 'What\'s your question?' : 'What\'s your suggestion?'}
              </label>
              <textarea
                id="feedback-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={
                  category === 'bug'
                    ? 'Describe what happened and what you expected...'
                    : category === 'question'
                    ? 'Ask your question...'
                    : 'Share your idea...'
                }
                rows={4}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[#101E57] placeholder:text-[#98A2B3] focus:outline-none focus:ring-2 focus:ring-[#6F71EE]/20 focus:border-[#6F71EE] resize-none"
              />
            </div>

            {/* Error message */}
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {error}
              </div>
            )}

            {/* Submit button */}
            <button
              type="submit"
              disabled={isSubmitting || !message.trim()}
              className="w-full bg-[#6F71EE] text-white py-2.5 rounded-lg hover:bg-[#5a5cd0] transition font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Sending...
                </>
              ) : (
                'Send Feedback'
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

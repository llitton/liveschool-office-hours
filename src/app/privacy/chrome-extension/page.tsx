import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Chrome Extension Privacy Policy - Connect with LiveSchool',
};

export default function ChromeExtensionPrivacyPage() {
  return (
    <div className="min-h-screen bg-[#F6F6F9] py-12 px-4">
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-sm border border-gray-200 p-8">
        <h1 className="text-2xl font-semibold text-[#101E57] mb-6">
          Chrome Extension Privacy Policy
        </h1>
        <p className="text-sm text-[#667085] mb-8">
          Last updated: January 2025
        </p>

        <div className="prose prose-sm max-w-none text-[#667085]">
          <h2 className="text-lg font-semibold text-[#101E57] mt-6 mb-3">
            Overview
          </h2>
          <p>
            The &quot;Connect with LiveSchool&quot; Chrome extension provides quick access to your
            LiveSchool scheduling links. This policy explains how we handle your data.
          </p>

          <h2 className="text-lg font-semibold text-[#101E57] mt-6 mb-3">
            Data We Collect
          </h2>
          <p>The extension collects and stores:</p>
          <ul className="list-disc pl-5 my-3 space-y-1">
            <li>
              <strong>Quick Links Token:</strong> A unique identifier that connects the extension
              to your LiveSchool account. This is stored locally in your browser using Chrome&apos;s
              sync storage.
            </li>
          </ul>

          <h2 className="text-lg font-semibold text-[#101E57] mt-6 mb-3">
            Data We Access
          </h2>
          <p>When you use the extension, it fetches from LiveSchool&apos;s servers:</p>
          <ul className="list-disc pl-5 my-3 space-y-1">
            <li>Your name and email (for display purposes)</li>
            <li>Your active event types and their booking URLs</li>
            <li>Upcoming slot counts for each event</li>
          </ul>

          <h2 className="text-lg font-semibold text-[#101E57] mt-6 mb-3">
            How We Use Your Data
          </h2>
          <ul className="list-disc pl-5 my-3 space-y-1">
            <li>To display your booking links in the extension popup</li>
            <li>To let you copy links to your clipboard</li>
            <li>To show which events have upcoming availability</li>
          </ul>

          <h2 className="text-lg font-semibold text-[#101E57] mt-6 mb-3">
            Data Sharing
          </h2>
          <p>
            We do not sell, share, or transfer your data to third parties. Your token and
            event data are only used to display information within the extension.
          </p>

          <h2 className="text-lg font-semibold text-[#101E57] mt-6 mb-3">
            Data Storage
          </h2>
          <ul className="list-disc pl-5 my-3 space-y-1">
            <li>Your token is stored locally using Chrome&apos;s sync storage</li>
            <li>Event data is fetched fresh each time you open the extension (not stored)</li>
            <li>No data is sent to any servers other than liveschoolhelp.com</li>
          </ul>

          <h2 className="text-lg font-semibold text-[#101E57] mt-6 mb-3">
            Permissions
          </h2>
          <p>The extension requires these permissions:</p>
          <ul className="list-disc pl-5 my-3 space-y-1">
            <li><strong>storage:</strong> To save your connection token locally</li>
            <li><strong>clipboardWrite:</strong> To copy booking links when you click &quot;Copy&quot;</li>
            <li><strong>Host permission (liveschoolhelp.com):</strong> To fetch your event data</li>
          </ul>

          <h2 className="text-lg font-semibold text-[#101E57] mt-6 mb-3">
            Your Rights
          </h2>
          <p>You can:</p>
          <ul className="list-disc pl-5 my-3 space-y-1">
            <li>Disconnect your account at any time via extension settings</li>
            <li>Remove the extension to delete all locally stored data</li>
            <li>Request deletion of your LiveSchool account data by contacting us</li>
          </ul>

          <h2 className="text-lg font-semibold text-[#101E57] mt-6 mb-3">
            Contact
          </h2>
          <p>
            For questions about this privacy policy or your data, contact us at{' '}
            <a href="mailto:laura@liveschoolinc.com" className="text-[#6F71EE]">
              laura@liveschoolinc.com
            </a>
          </p>

          <h2 className="text-lg font-semibold text-[#101E57] mt-6 mb-3">
            Changes
          </h2>
          <p>
            We may update this policy occasionally. Significant changes will be communicated
            through the extension or our website.
          </p>
        </div>

        <div className="mt-8 pt-6 border-t border-gray-200 text-center">
          <a
            href="https://liveschoolhelp.com"
            className="text-[#6F71EE] text-sm hover:underline"
          >
            ← Back to LiveSchool
          </a>
        </div>
      </div>
    </div>
  );
}

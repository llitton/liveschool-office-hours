'use client';

import { Suspense, useState, useEffect } from 'react';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';

type LoginState = 'idle' | 'signing_in' | 'error';

function LoginContent() {
  const searchParams = useSearchParams();
  const [state, setState] = useState<LoginState>('idle');
  const error = searchParams.get('error');

  // Handle error states from redirect
  useEffect(() => {
    if (error) {
      setState('error');
    }
  }, [error]);

  const handleSignIn = () => {
    setState('signing_in');
    window.location.href = '/api/auth/login';
  };

  const handleRetry = () => {
    setState('idle');
    // Clear error from URL
    window.history.replaceState({}, '', '/login');
  };

  // Error state
  if (state === 'error') {
    return (
      <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full text-center">
        <Image
          src="https://info.whyliveschool.com/hubfs/Brand/liveschool-logo.png"
          alt="LiveSchool"
          width={140}
          height={36}
          className="mx-auto mb-8"
        />

        <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
          <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>

        <h1 className="text-xl font-semibold text-[#101E57] mb-2">
          We couldn&apos;t finish signing you in
        </h1>
        <p className="text-[#667085] mb-6 text-sm">
          {error === 'unauthorized'
            ? 'Your email is not authorized. Please contact an administrator.'
            : 'Try again, or contact support if this keeps happening.'}
        </p>

        <div className="space-y-3">
          <button
            onClick={handleRetry}
            className="w-full bg-[#101E57] text-white px-6 py-3 rounded-lg hover:bg-[#1a2d6e] transition font-medium"
          >
            Try again
          </button>
          <a
            href="mailto:support@whyliveschool.com"
            className="block text-sm text-[#667085] hover:text-[#101E57] transition"
          >
            Contact support
          </a>
        </div>
      </div>
    );
  }

  // Signing in state
  if (state === 'signing_in') {
    return (
      <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full text-center">
        <Image
          src="https://info.whyliveschool.com/hubfs/Brand/liveschool-logo.png"
          alt="LiveSchool"
          width={140}
          height={36}
          className="mx-auto mb-8"
        />

        <div className="w-12 h-12 mx-auto mb-4">
          <svg className="animate-spin h-12 w-12 text-[#6F71EE]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>

        <h1 className="text-xl font-semibold text-[#101E57] mb-2">
          Signing you in…
        </h1>
        <p className="text-[#667085] text-sm">
          Redirecting to your organization
        </p>
      </div>
    );
  }

  // Default idle state
  return (
    <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full text-center">
      <Image
        src="https://info.whyliveschool.com/hubfs/Brand/liveschool-logo.png"
        alt="LiveSchool"
        width={140}
        height={36}
        className="mx-auto mb-8"
      />

      <h1 className="text-2xl font-semibold text-[#101E57] mb-1">
        Sign in to LiveSchool
      </h1>
      <p className="text-[#667085] mb-8">
        Admin Dashboard
      </p>

      <button
        onClick={handleSignIn}
        className="w-full inline-flex items-center justify-center gap-3 bg-[#101E57] text-white px-6 py-3 rounded-lg hover:bg-[#1a2d6e] transition font-medium mb-4"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24">
          <path
            fill="currentColor"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="currentColor"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="currentColor"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
          />
          <path
            fill="currentColor"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          />
        </svg>
        Continue with Google
      </button>

      <p className="text-sm text-[#667085] mb-6">
        Use your school or district Google account.
      </p>

      <p className="text-xs text-[#667085] mb-4">
        After you sign in, you&apos;ll be redirected to your organization.
      </p>

      <a
        href="mailto:support@whyliveschool.com"
        className="text-xs text-[#667085] hover:text-[#6F71EE] transition"
      >
        Trouble signing in? Contact support
      </a>
    </div>
  );
}

function LoginFallback() {
  return (
    <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full text-center">
      <Image
        src="https://info.whyliveschool.com/hubfs/Brand/liveschool-logo.png"
        alt="LiveSchool"
        width={140}
        height={36}
        className="mx-auto mb-8"
      />
      <div className="w-8 h-8 mx-auto mb-4">
        <svg className="animate-spin h-8 w-8 text-[#6F71EE]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginContent />
    </Suspense>
  );
}

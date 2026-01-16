import Image from 'next/image';
import AdminNav from './AdminNav';

interface AdminHeaderProps {
  email: string;
}

export default function AdminHeader({ email }: AdminHeaderProps) {
  return (
    <header className="bg-white">
      {/* Top bar with logo and user */}
      <div className="border-b border-[#E0E0E0]">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image
              src="https://info.whyliveschool.com/hubfs/Brand/liveschool-logo.png"
              alt="LiveSchool"
              width={120}
              height={32}
            />
            <div className="w-px h-6 bg-[#E0E0E0]" />
            <span className="text-[#101E57] text-sm font-semibold">Sessions</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-[#667085]">{email}</span>
            <a
              href="/api/auth/logout"
              className="text-sm text-[#667085] hover:text-red-600 transition"
            >
              Sign out
            </a>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <AdminNav showSubNav={true} />
    </header>
  );
}

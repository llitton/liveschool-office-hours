import Image from 'next/image';
import AdminNav from './AdminNav';

interface AdminHeaderProps {
  email: string;
}

export default function AdminHeader({ email }: AdminHeaderProps) {
  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-4">
            <Image
              src="https://info.whyliveschool.com/hubfs/Brand/liveschool-logo.png"
              alt="LiveSchool"
              width={140}
              height={36}
            />
            <span className="text-[#667085] text-sm font-medium">Office Hours</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-[#667085] text-sm">{email}</span>
            <a
              href="/api/auth/logout"
              className="text-red-600 hover:text-red-700 text-sm font-medium"
            >
              Sign out
            </a>
          </div>
        </div>
        <AdminNav />
      </div>
    </header>
  );
}

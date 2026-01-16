export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-[#F6F6F9] flex items-center justify-center">
      {children}
    </main>
  );
}

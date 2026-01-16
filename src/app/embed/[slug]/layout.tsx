import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Book a Session',
};

export default function EmbedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{ margin: 0, padding: 0, fontFamily: 'Poppins, sans-serif' }}>
        {children}
      </body>
    </html>
  );
}

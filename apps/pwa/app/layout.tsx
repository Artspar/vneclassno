import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'VneClassno PWA',
  description: 'Invite onboarding for sections',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}

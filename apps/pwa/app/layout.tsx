import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import { Manrope, Space_Grotesk } from 'next/font/google';
import './globals.css';

const manrope = Manrope({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-body',
  display: 'swap',
});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-heading',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'VneClassno PWA',
  description: 'Invite onboarding for sections',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body className={`${manrope.variable} ${spaceGrotesk.variable}`}>
        <Script id="disable-mobile-zoom" strategy="beforeInteractive">
          {`(function(){
            var lastTouchEnd = 0;
            document.addEventListener('gesturestart', function (event) {
              event.preventDefault();
            }, { passive: false });
            document.addEventListener('touchend', function (event) {
              var now = Date.now();
              if (now - lastTouchEnd <= 300) {
                event.preventDefault();
              }
              lastTouchEnd = now;
            }, { passive: false });
          })();`}
        </Script>
        {children}
      </body>
    </html>
  );
}

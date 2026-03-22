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
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'VneClassno',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#404152',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
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

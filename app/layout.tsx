import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Aether Drift — The Stellar Wake',
  description:
    'See the sky as motion. Glowing trails of where satellites, the ISS, planets, and the Moon have been over the last 72 hours — and where they\'re going next.',
  themeColor: '#050A14',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#050A14',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        {/*
          CesiumJS resolves its Web Workers, Assets, and Widgets from this
          global at runtime. It must be set before the `cesium` package is
          first imported/executed, so it's injected here as a blocking
          inline script rather than via next/script or a useEffect (which
          would run too late, after Cesium has already tried to resolve
          its base URL).
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `window.CESIUM_BASE_URL = '/cesium';`,
          }}
        />
      </head>
      <body className="bg-space-bg text-text-primary font-sans antialiased overflow-x-hidden">
        {children}
      </body>
    </html>
  );
}

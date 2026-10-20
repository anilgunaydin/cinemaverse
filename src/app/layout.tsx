import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SWRegister } from "@/components/pwa/sw-register";
import { PWAMeta } from "@/components/pwa/pwa-meta";

export const metadata: Metadata = {
  title: {
    default: "CinemaVerse — Kişisel Sinema Hafızası",
    template: "%s · CinemaVerse",
  },
  description:
    "İzlediğiniz filmleri ve dizileri kaydedin, zevkinize göre açıklanabilir öneriler alın, kaynaklı eleştiri araştırması yapın.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "CinemaVerse",
  },
  applicationName: "CinemaVerse",
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icons/icon-192.png", sizes: "192x192" },
      { url: "/icons/icon-512.png", sizes: "512x512" },
    ],
    shortcut: ["/icons/icon-192.png"],
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0f0f12" },
    { media: "(prefers-color-scheme: light)", color: "#d4a94f" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr" data-scroll-behavior="smooth">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="CinemaVerse" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body>
        {children}
        <SWRegister />
        <PWAMeta />
      </body>
    </html>
  );
}
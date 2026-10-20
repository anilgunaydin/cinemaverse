import type { Metadata } from "next";
import "./globals.css";
import { SWRegister } from "@/components/pwa/sw-register";

export const metadata: Metadata = {
  title: {
    default: "CinemaVerse — Kişisel Sinema Hafızası",
    template: "%s · CinemaVerse",
  },
  description:
    "İzlediğiniz filmleri ve dizileri kaydedin, zevkinize göre açıklanabilir öneriler alın, kaynaklı eleştiri araştırması yapın.",
  manifest: "/manifest.json",
  themeColor: "#d4a94f",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "CinemaVerse",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icons/icon-192.png", sizes: "192x192" },
      { url: "/icons/icon-512.png", sizes: "512x512" },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <meta name="theme-color" content="#d4a94f" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="CinemaVerse" />
      </head>
      <body>
        {children}
        <SWRegister />
      </body>
    </html>
  );
}
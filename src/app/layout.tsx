import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "CinemaVerse — Kişisel Sinema Hafızası",
    template: "%s · CinemaVerse",
  },
  description:
    "İzlediğiniz filmleri ve dizileri kaydedin, zevkinize göre açıklanabilir öneriler alın, kaynaklı eleştiri araştırması yapın.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}

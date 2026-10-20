import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sinema Karakterin",
  description:
    "Kütüphaneden yola çıkarak AI'ın çizdiği sinema profilin: arketipin, güçlü yönlerin, sevdiğin türler ve favori kadron.",
  openGraph: {
    title: "Sinema Karakterim · CinemaVerse",
    description:
      "Kütüphanemden yola çıkarak çıkarılan sinema arketipim, güçlü yönlerim ve favori kadrom.",
    type: "profile",
    images: [
      {
        url: "/api/og/karakter",
        width: 1200,
        height: 630,
        alt: "Sinema karakterin kartı",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Sinema Karakterim · CinemaVerse",
    description: "Kütüphanemden yola çıkarak çıkarılan sinema profilim.",
    images: ["/api/og/karakter"],
  },
};

export default function KarakterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

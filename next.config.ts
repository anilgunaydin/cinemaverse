import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Oturum okuyan sayfalar her istekte dinamik render edilir; Cache Components
  // bu projede ek karmasiklik getirdigi icin kapali tutuluyor.
  cacheComponents: false,
  // better-sqlite3 yerel bir modul; bundler'a sokulmaz.
  serverExternalPackages: ["better-sqlite3"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "image.tmdb.org" },
      { protocol: "https", hostname: "static.tvmaze.com" },
      { protocol: "https", hostname: "m.media-amazon.com" },
      { protocol: "https", hostname: "upload.wikimedia.org" },
    ],
  },
};

export default nextConfig;

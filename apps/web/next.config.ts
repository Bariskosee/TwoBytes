import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Paneli telefondan veya hotspot'taki diğer bilgisayardan açarken geliştirme
  // kaynakları (HMR, istemci JS) engellenmesin. iPhone hotspot'u 172.20.10.x verir.
  allowedDevOrigins: ["172.20.10.*"],
  // Sunumda sol alttaki Next.js geliştirme simgesi görünmesin.
  devIndicators: false,
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "globals.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

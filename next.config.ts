import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cache Components bilinçli olarak kapalı: uygulamanın tüm ekranları oturum açmış
  // kullanıcıya ve yetkili olduğu projelere özel, yani her istekte dinamik üretilir.
  poweredByHeader: false,
  experimental: {
    serverActions: {
      // Fiş/fatura fotoğrafları ve Excel dosyaları Server Action ile yüklenir (varsayılan 1 MB).
      bodySizeLimit: "40mb",
    },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

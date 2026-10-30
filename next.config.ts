import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cache Components bilinçli olarak kapalı: uygulamanın tüm ekranları oturum açmış
  // kullanıcıya ve yetkili olduğu projelere özel, yani her istekte dinamik üretilir.
  poweredByHeader: false,
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

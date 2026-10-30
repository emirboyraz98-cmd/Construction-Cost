import type { MetadataRoute } from "next";

/** Telefona “ana ekrana ekle” ile uygulama gibi kurulabilmesi için (PLAN.md 8.2). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "İnşaat Maliyet",
    short_name: "İnşaat",
    description: "İnşaat maliyet, harcama ve satış takip programı",
    lang: "tr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#1d4f91",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

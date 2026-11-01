import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "İnşaat Maliyet",
    template: "%s · İnşaat Maliyet",
  },
  description: "İnşaat maliyet, fiyatlandırma, harcama, bağlantı ve satış takip programı",
  appleWebApp: { capable: true, title: "İnşaat", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1d4f91",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="tr" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}

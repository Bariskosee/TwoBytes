import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Güvenlik Haritası",
  description: "TwoBytes Güvenlik Haritası kurum paneli",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="tr" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

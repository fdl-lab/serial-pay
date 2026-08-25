import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { MobileNav } from "@/components/layout/MobileNav";
import { SiteFooter } from "@/components/layout/SiteFooter";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
      "https://www.serial-pay.com",
  ),
  title: {
    default: "シリアルPay",
    template: "%s | シリアルPay",
  },
  description: "推し活特化型 応募用シリアルコード譲渡プラットフォーム",
  applicationName: "シリアルPay",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "シリアルPay",
  },
  openGraph: {
    type: "website",
    locale: "ja_JP",
    siteName: "シリアルPay",
    title: "シリアルPay",
    description: "推し活特化型 応募用シリアルコード譲渡プラットフォーム",
    url: "/",
  },
  twitter: {
    card: "summary",
    title: "シリアルPay",
    description: "推し活特化型 応募用シリアルコード譲渡プラットフォーム",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#00c2a8",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>
        <div className="shell">
          {children}
          <SiteFooter />
        </div>
        <MobileNav />
        <Analytics />
        <script
          dangerouslySetInnerHTML={{
            __html: `if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}))}`,
          }}
        />
      </body>
    </html>
  );
}

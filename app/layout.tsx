import type { Metadata, Viewport } from "next";
import "./globals.css";
import { RegisterServiceWorker } from "./register-sw";
import Footer from "@/components/Footer";
import Header from "@/components/Header";

export const metadata: Metadata = {
  title: "OKPARTS ADMIN",
  description: "오케이중고부품 공급사 상품 등록 시스템",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: "#3b82f6",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body style={{ minHeight: '100vh' }}>
        <a href="#main" className="skip-link">본문 바로가기</a>
        <RegisterServiceWorker />
        <Footer />
        <Header />
        {children}
      </body>
    </html>
  );
}

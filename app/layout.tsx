import type { Metadata, Viewport } from "next";
import "./globals.css";
import { RegisterServiceWorker } from "./register-sw";

export const metadata: Metadata = {
  title: "OKPARTS ADMIN",
  description: "오케이중고부품 공급사 상품 등록 시스템",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5, // iOS PWA에서 키보드 입력을 위해 확대 허용
  userScalable: true, // iOS PWA에서 키보드를 위해 true로 변경
  themeColor: "#3b82f6",
  viewportFit: "cover", // iOS Safe Area 대응
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
      <body>
        <a href="#main" className="skip-link">본문 바로가기</a>
        <RegisterServiceWorker />
        {children}
      </body>
    </html>
  );
}

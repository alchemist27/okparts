"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function InstallPage() {
  const router = useRouter();

  useEffect(() => {
    // 자동으로 OAuth 플로우 시작
    window.location.href = "/api/auth/install";
  }, []);

  return (
    <main className="min-h-screen hero flex items-center justify-center">
      <div className="container">
        <div className="hero-card">
          <h1 className="text-center mb-4">카페24 앱 설치 중...</h1>
          <p className="text-center text-muted">
            카페24 인증 페이지로 이동합니다.
          </p>
        </div>
      </div>
    </main>
  );
}

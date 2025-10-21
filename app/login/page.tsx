"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

// 랜덤 더미 데이터 생성
function generateDummyData() {
  const randomNum = Math.floor(Math.random() * 10000);
  const password = `pw${randomNum}ab!`;
  return {
    userId: `user${randomNum}`,
    password: password,
  };
}

export default function LoginPage() {
  const router = useRouter();
  const [formData, setFormData] = useState(generateDummyData());
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // 페이지 로드시 더미 데이터 재생성
  useEffect(() => {
    setFormData(generateDummyData());
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/supplier/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "로그인에 실패했습니다");
      }

      // 토큰 저장
      localStorage.setItem("token", data.token);
      localStorage.setItem("supplier", JSON.stringify(data.supplier));

      // 상품등록 페이지로 이동
      router.push("/products/new");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main id="main" className="min-h-screen hero flex items-center justify-center py-4">
      <div className="container">
        {/* 로고 - 최상단 배치 */}
        <div className="text-center mb-6">
          <Image
            src="/logo.png"
            alt="OK중고부품"
            width={750}
            height={300}
            priority
            style={{ width: "100%", height: "auto", maxWidth: "280px" }}
          />
        </div>

        <div className="hero-card" style={{ padding: '2rem' }}>
          {/* 제목 */}
          <h1 className="text-center hero-title mb-2" style={{ fontSize: '1.75rem' }}>로그인</h1>
          <p className="text-center hero-subtitle mb-4" style={{ fontSize: '1.125rem' }}>공급사 계정으로 로그인하세요</p>

          {/* 에러 메시지 */}
          {error && (
            <div className="alert alert-error mb-4" style={{ fontSize: '1.125rem' }}>
              {error}
            </div>
          )}

          {/* 로그인 폼 */}
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            {/* 아이디 */}
            <div>
              <label htmlFor="userId" style={{ fontSize: "1.25rem", fontWeight: "700", marginBottom: "0.5rem", display: "block" }}>
                아이디
              </label>
              <input
                id="userId"
                name="userId"
                type="text"
                autoComplete="username"
                inputMode="text"
                value={formData.userId}
                onChange={(e) => setFormData({ ...formData, userId: e.target.value })}
                style={{ fontSize: "1.25rem", padding: "1rem", borderRadius: "12px" }}
                required
                autoFocus
              />
            </div>

            {/* 비밀번호 */}
            <div>
              <label htmlFor="password" style={{ fontSize: "1.25rem", fontWeight: "700", marginBottom: "0.5rem", display: "block" }}>
                비밀번호
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                inputMode="text"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                style={{ fontSize: "1.25rem", padding: "1rem", borderRadius: "12px" }}
                required
              />
            </div>

            {/* 로그인 버튼 */}
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary btn-xl btn-block"
              style={{ marginTop: "0.75rem" }}
            >
              {loading ? "로그인 중..." : "로그인"}
            </button>
          </form>

          {/* 하단 링크 */}
          <div className="text-center" style={{ marginTop: "1.5rem", fontSize: "1.125rem" }}>
            <div style={{ marginBottom: "0.75rem" }}>
              <span style={{ color: "#6b7280" }}>계정이 없으신가요? </span>
              <a href="/signup" style={{ color: "var(--primary)", fontWeight: "700" }}>
                회원가입
              </a>
            </div>
            <a href="/" style={{ color: "#6b7280", fontWeight: "600" }}>
              ←   돌아가기
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}

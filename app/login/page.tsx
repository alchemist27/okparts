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

      // 대시보드로 이동
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="card" style={{ padding: "2rem" }}>
          {/* 로고 */}
          <div className="mb-8 flex justify-center">
            <Image
              src="/logo.svg"
              alt="OK중고부품"
              width={240}
              height={96}
              priority
              className="w-full max-w-[240px] h-auto"
            />
          </div>

          <h1
            style={{
              fontSize: "2rem",
              fontWeight: "bold",
              marginBottom: "0.5rem",
              textAlign: "center",
            }}
          >
            로그인
          </h1>
          <p
            style={{
              fontSize: "1.125rem",
              color: "#6b7280",
              marginBottom: "2rem",
              textAlign: "center",
            }}
          >
            공급사 계정으로 로그인하세요
          </p>

          {error && (
            <div
              className="alert alert-error"
              style={{ fontSize: "1.125rem", marginBottom: "1.5rem" }}
            >
              {error}
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}
          >
            {/* 아이디 */}
            <div>
              <label
                style={{
                  fontSize: "1.25rem",
                  fontWeight: "600",
                  marginBottom: "0.5rem",
                  display: "block",
                }}
              >
                아이디
              </label>
              <input
                type="text"
                value={formData.userId}
                onChange={(e) =>
                  setFormData({ ...formData, userId: e.target.value })
                }
                style={{ fontSize: "1.25rem", padding: "1rem" }}
                required
              />
            </div>

            {/* 비밀번호 */}
            <div>
              <label
                style={{
                  fontSize: "1.25rem",
                  fontWeight: "600",
                  marginBottom: "0.5rem",
                  display: "block",
                }}
              >
                비밀번호
              </label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
                style={{ fontSize: "1.25rem", padding: "1rem" }}
                required
              />
            </div>

            {/* 로그인 버튼 */}
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
              style={{
                fontSize: "1.5rem",
                padding: "1.25rem",
                marginTop: "1rem",
                fontWeight: "bold",
              }}
            >
              {loading ? "로그인 중..." : "로그인"}
            </button>
          </form>

          <div
            style={{
              marginTop: "1.5rem",
              textAlign: "center",
              fontSize: "1.125rem",
            }}
          >
            <span style={{ color: "#6b7280" }}>계정이 없으신가요? </span>
            <a href="/signup" style={{ color: "#3b82f6", fontWeight: "600" }}>
              회원가입
            </a>
          </div>

          <div style={{ marginTop: "1rem", textAlign: "center" }}>
            <a href="/" style={{ fontSize: "1.125rem", color: "#6b7280" }}>
              ← 홈으로 돌아가기
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}

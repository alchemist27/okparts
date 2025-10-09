"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

type AccountType = "individual" | "business" | null;

// 랜덤 더미 데이터 생성
function generateDummyData() {
  const randomNum = Math.floor(Math.random() * 10000);
  // 비밀번호: 4개 이상 연속된 문자 불가
  const password = `pw${randomNum}ab!`;
  return {
    userId: `user${randomNum}`,
    password: password,
    passwordConfirm: password,
    name: `테스터${randomNum}`,
    companyName: `테스트회사${randomNum}`,
    phone: `010-${String(randomNum).padStart(4, '0')}-${String(randomNum).padStart(4, '0')}`,
    businessNumber: `${randomNum}-${randomNum}-${randomNum}`,
    presidentName: `대표${randomNum}`,
  };
}

export default function SignupPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [accountType, setAccountType] = useState<AccountType>(null);
  const [formData, setFormData] = useState(generateDummyData());
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // 페이지 로드시 더미 데이터 재생성
  useEffect(() => {
    setFormData(generateDummyData());
  }, []);

  const handleAccountTypeSelect = (type: AccountType) => {
    setAccountType(type);
    setStep(2);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // 비밀번호 확인
    if (formData.password !== formData.passwordConfirm) {
      setError("비밀번호가 일치하지 않습니다");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/supplier/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          accountType,
          userId: formData.userId,
          password: formData.password,
          name: formData.name,
          companyName: accountType === "individual" ? formData.name : formData.companyName,
          phone: formData.phone,
          businessNumber: accountType === "business" ? formData.businessNumber : null,
          presidentName: accountType === "business" ? formData.presidentName : null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "회원가입에 실패했습니다");
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
    <main id="main" className="min-h-screen hero flex items-center justify-center py-4">
      <div className="container">
        {/* 로고 - 최상단 배치 */}
        <div className="text-center mb-4">
          <Image
            src="/logo.png"
            alt="OK중고부품"
            width={750}
            height={300}
            priority
            style={{ width: "100%", height: "auto", maxWidth: "280px" }}
          />
        </div>

        {/* STEP 1: 회원 유형 선택 */}
        {step === 1 && (
          <div className="hero-card" style={{ padding: '2rem' }}>
            {/* 제목 */}
            <h1 className="text-center hero-title mb-2" style={{ fontSize: '1.75rem' }}>회원가입</h1>
            <p className="text-center hero-subtitle mb-6" style={{ fontSize: '1.125rem' }}>회원 유형을 선택해주세요</p>

            {/* 회원 유형 선택 버튼 */}
            <div className="btn-mobile-stack">
              <button
                type="button"
                onClick={() => handleAccountTypeSelect("individual")}
                className="btn btn-xl"
                style={{
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '1.5rem 1rem',
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  border: 'none'
                }}
              >
                <div style={{ fontSize: '1.375rem', fontWeight: '700' }}>개인회원</div>
                <div style={{ fontSize: '1.125rem', color: 'rgba(255,255,255,0.9)', fontWeight: 'normal' }}>
                  수수료 없음 (0%)
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleAccountTypeSelect("business")}
                className="btn btn-xl"
                style={{
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '1.5rem 1rem',
                  backgroundColor: '#f59e0b',
                  color: 'white',
                  border: 'none'
                }}
              >
                <div style={{ fontSize: '1.375rem', fontWeight: '700' }}>사업자회원</div>
                <div style={{ fontSize: '1.125rem', color: 'rgba(255,255,255,0.9)', fontWeight: 'normal' }}>
                  수수료 10%
                </div>
              </button>
            </div>

            {/* 하단 링크 */}
            <div className="text-center" style={{ marginTop: '1.5rem', fontSize: '1.125rem' }}>
              <a href="/" style={{ color: '#6b7280', fontWeight: '600' }}>
                ← 홈으로 돌아가기
              </a>
            </div>
          </div>
        )}

        {/* STEP 2: 정보 입력 */}
        {step === 2 && (
          <div className="hero-card" style={{ padding: '1.5rem', overflowY: 'auto' }}>
            {/* 헤더 */}
            <div className="flex items-center justify-between mb-4">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="btn btn-outline primary"
                style={{ padding: '0.5rem 1rem', fontSize: '0.7rem' }}
              >
                이전
              </button>
              <h2 className="hero-title text-center" style={{ fontSize: '1.5rem', margin: 0 }}>
                {accountType === "individual" ? "개인회원" : "사업자회원"} 정보 입력
              </h2>
              <div style={{ width: '80px' }}></div>
            </div>

            <p className="text-center hero-subtitle mb-4" style={{ fontSize: '1rem' }}>
              * 표시는 필수 입력 항목입니다
            </p>

            {/* 에러 메시지 */}
            {error && (
              <div className="alert alert-error mb-4" style={{ fontSize: '1rem' }}>
                {error}
              </div>
            )}

            {/* 폼 */}
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* 아이디 */}
              <div>
                <label style={{ fontSize: '1.125rem', fontWeight: '700', marginBottom: '0.5rem', display: 'block' }}>
                  아이디 *
                </label>
                <input
                  type="text"
                  value={formData.userId}
                  onChange={(e) => setFormData({ ...formData, userId: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '') })}
                  style={{ fontSize: '1.125rem', padding: '0.875rem', borderRadius: '8px' }}
                  placeholder="영문 소문자, 숫자만 가능"
                  required
                  pattern="[a-z0-9]+"
                  minLength={4}
                />
                <p style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.25rem' }}>
                  영문 소문자와 숫자만 사용 가능 (최소 4자)
                </p>
              </div>

              {/* 비밀번호 */}
              <div>
                <label style={{ fontSize: '1.125rem', fontWeight: '700', marginBottom: '0.5rem', display: 'block' }}>
                  비밀번호 *
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  style={{ fontSize: '1.125rem', padding: '0.875rem', borderRadius: '8px' }}
                  required
                  minLength={6}
                />
                <p style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.25rem' }}>
                  영문/숫자/특수문자 조합 최소 6자 이상
                </p>
              </div>

              {/* 비밀번호 확인 */}
              <div>
                <label style={{ fontSize: '1.125rem', fontWeight: '700', marginBottom: '0.5rem', display: 'block' }}>
                  비밀번호 확인 *
                </label>
                <input
                  type="password"
                  value={formData.passwordConfirm}
                  onChange={(e) => setFormData({ ...formData, passwordConfirm: e.target.value })}
                  style={{ fontSize: '1.125rem', padding: '0.875rem', borderRadius: '8px' }}
                  required
                />
              </div>

              {/* 개인회원: 회원명 / 사업자회원: 상호명 */}
              {accountType === "individual" ? (
                <div>
                  <label style={{ fontSize: '1.125rem', fontWeight: '700', marginBottom: '0.5rem', display: 'block' }}>
                    회원명 *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    style={{ fontSize: '1.125rem', padding: '0.875rem', borderRadius: '8px' }}
                    required
                  />
                </div>
              ) : (
                <>
                  <div>
                    <label style={{ fontSize: '1.125rem', fontWeight: '700', marginBottom: '0.5rem', display: 'block' }}>
                      상호명 *
                    </label>
                    <input
                      type="text"
                      value={formData.companyName}
                      onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                      style={{ fontSize: '1.125rem', padding: '0.875rem', borderRadius: '8px' }}
                      required
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '1.125rem', fontWeight: '700', marginBottom: '0.5rem', display: 'block' }}>
                      담당자명 *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      style={{ fontSize: '1.125rem', padding: '0.875rem', borderRadius: '8px' }}
                      required
                    />
                  </div>
                </>
              )}

              {/* 휴대폰 */}
              <div>
                <label style={{ fontSize: '1.125rem', fontWeight: '700', marginBottom: '0.5rem', display: 'block' }}>
                  휴대폰 *
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="010-1234-5678"
                  style={{ fontSize: '1.125rem', padding: '0.875rem', borderRadius: '8px' }}
                  required
                />
              </div>

              {/* 사업자회원 추가 정보 */}
              {accountType === "business" && (
                <>
                  <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '1rem', marginTop: '0.5rem' }}>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '0.75rem', textAlign: 'center' }}>
                      사업자 정보
                    </h3>
                  </div>

                  <div>
                    <label style={{ fontSize: '1.125rem', fontWeight: '700', marginBottom: '0.5rem', display: 'block' }}>
                      사업자등록번호 *
                    </label>
                    <input
                      type="text"
                      value={formData.businessNumber}
                      onChange={(e) => setFormData({ ...formData, businessNumber: e.target.value })}
                      placeholder="123-45-67890"
                      style={{ fontSize: '1.125rem', padding: '0.875rem', borderRadius: '8px' }}
                      required
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '1.125rem', fontWeight: '700', marginBottom: '0.5rem', display: 'block' }}>
                      대표자명 *
                    </label>
                    <input
                      type="text"
                      value={formData.presidentName}
                      onChange={(e) => setFormData({ ...formData, presidentName: e.target.value })}
                      style={{ fontSize: '1.125rem', padding: '0.875rem', borderRadius: '8px' }}
                      required
                    />
                  </div>
                </>
              )}

              {/* 제출 버튼 */}
              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary btn-xl btn-block"
                style={{ marginTop: '1rem' }}
              >
                {loading ? "처리 중..." : "회원가입"}
              </button>
            </form>

            {/* 하단 링크 */}
            <div className="text-center" style={{ marginTop: '1rem', fontSize: '1rem' }}>
              <div style={{ marginBottom: '0.5rem' }}>
                <span style={{ color: '#6b7280' }}>이미 계정이 있으신가요? </span>
                <a href="/login" style={{ color: 'var(--primary)', fontWeight: '700' }}>
                  로그인
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
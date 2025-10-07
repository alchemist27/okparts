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
    <main className="min-h-screen py-8 px-4" style={{ background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" }}>
      <div className="max-w-4xl mx-auto">
        {/* 진행 단계 표시 */}
        <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
          <div className="flex justify-center items-center gap-4 text-xl sm:text-2xl font-bold">
            <div style={{
              color: step >= 1 ? 'white' : 'rgba(255,255,255,0.5)',
              background: step >= 1 ? 'rgba(255,255,255,0.2)' : 'transparent',
              padding: '0.5rem 1.5rem',
              borderRadius: '2rem',
              border: step >= 1 ? '2px solid white' : '2px solid rgba(255,255,255,0.3)'
            }}>
              1. 회원유형
            </div>
            <div style={{ color: 'white', fontSize: '2rem' }}>→</div>
            <div style={{
              color: step >= 2 ? 'white' : 'rgba(255,255,255,0.5)',
              background: step >= 2 ? 'rgba(255,255,255,0.2)' : 'transparent',
              padding: '0.5rem 1.5rem',
              borderRadius: '2rem',
              border: step >= 2 ? '2px solid white' : '2px solid rgba(255,255,255,0.3)'
            }}>
              2. 정보입력
            </div>
          </div>
        </div>

        {/* STEP 1: 회원 유형 선택 */}
        {step === 1 && (
          <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-8 py-10 text-center">
              {/* 로고 */}
              <div className="mb-6 flex justify-center">
                <div className="bg-white rounded-xl px-6 py-4 shadow-lg">
                  <Image
                    src="/logo.png"
                    alt="OK중고부품"
                    width={750}
                    height={300}
                    priority
                    style={{ width: "100%", height: "auto", maxWidth: "350px" }}
                  />
                </div>
              </div>

              <h1 className="text-white text-3xl sm:text-4xl font-bold mb-2">
                회원가입
              </h1>
              <p className="text-white/90 text-lg sm:text-xl">
                회원 유형을 선택해주세요
              </p>
            </div>

            <div style={{ padding: '3rem', textAlign: 'center' }}>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '500px', margin: '0 auto' }}>
              <button
                type="button"
                onClick={() => handleAccountTypeSelect("individual")}
                style={{
                  padding: '2rem',
                  fontSize: '1.5rem',
                  fontWeight: 'bold',
                  backgroundColor: 'white',
                  border: '3px solid #e5e7eb',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.borderColor = '#3b82f6';
                  e.currentTarget.style.backgroundColor = '#eff6ff';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.borderColor = '#e5e7eb';
                  e.currentTarget.style.backgroundColor = 'white';
                }}
              >
                👤 개인회원
                <div style={{ fontSize: '1rem', color: '#6b7280', marginTop: '0.5rem', fontWeight: 'normal' }}>
                  수수료 없음 (0%)
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleAccountTypeSelect("business")}
                style={{
                  padding: '2rem',
                  fontSize: '1.5rem',
                  fontWeight: 'bold',
                  backgroundColor: 'white',
                  border: '3px solid #e5e7eb',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.borderColor = '#3b82f6';
                  e.currentTarget.style.backgroundColor = '#eff6ff';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.borderColor = '#e5e7eb';
                  e.currentTarget.style.backgroundColor = 'white';
                }}
              >
                🏢 사업자회원
                <div style={{ fontSize: '1rem', color: '#6b7280', marginTop: '0.5rem', fontWeight: 'normal' }}>
                  수수료 10%
                </div>
              </button>
            </div>

            <div style={{ marginTop: '2rem' }}>
              <a href="/" style={{ fontSize: '1.125rem', color: '#6b7280' }}>
                ← 홈으로 돌아가기
              </a>
            </div>
            </div>
          </div>
        )}

        {/* STEP 2: 정보 입력 */}
        {step === 2 && (
          <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-8 py-6 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="text-white text-xl font-semibold hover:bg-white/20 px-4 py-2 rounded-lg transition-all"
              >
                ← 이전
              </button>
              <h2 className="text-white text-2xl sm:text-3xl font-bold">
                {accountType === "individual" ? "개인회원" : "사업자회원"} 정보 입력
              </h2>
              <div style={{ width: '80px' }}></div>
            </div>

            <div style={{ padding: '2rem' }}>
            <p style={{ fontSize: '1.125rem', color: '#6b7280', marginBottom: '2rem', textAlign: 'center' }}>
              * 표시는 필수 입력 항목입니다
            </p>

            {error && (
              <div className="alert alert-error" style={{ fontSize: '1.125rem', marginBottom: '1.5rem' }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* 아이디 */}
              <div>
                <label style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.5rem', display: 'block' }}>
                  아이디 *
                </label>
                <input
                  type="text"
                  value={formData.userId}
                  onChange={(e) => setFormData({ ...formData, userId: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '') })}
                  style={{ fontSize: '1.25rem', padding: '1rem' }}
                  placeholder="영문 소문자, 숫자만 가능"
                  required
                  pattern="[a-z0-9]+"
                  minLength={4}
                />
                <p style={{ fontSize: '1rem', color: '#6b7280', marginTop: '0.5rem' }}>
                  영문 소문자와 숫자만 사용 가능 (최소 4자)
                </p>
              </div>

              {/* 비밀번호 */}
              <div>
                <label style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.5rem', display: 'block' }}>
                  비밀번호 *
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  style={{ fontSize: '1.25rem', padding: '1rem' }}
                  required
                  minLength={6}
                />
                <p style={{ fontSize: '1rem', color: '#6b7280', marginTop: '0.5rem' }}>
                  최소 6자 이상
                </p>
              </div>

              {/* 비밀번호 확인 */}
              <div>
                <label style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.5rem', display: 'block' }}>
                  비밀번호 확인 *
                </label>
                <input
                  type="password"
                  value={formData.passwordConfirm}
                  onChange={(e) => setFormData({ ...formData, passwordConfirm: e.target.value })}
                  style={{ fontSize: '1.25rem', padding: '1rem' }}
                  required
                />
              </div>

              {/* 개인회원: 회원명 / 사업자회원: 상호명 */}
              {accountType === "individual" ? (
                <div>
                  <label style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.5rem', display: 'block' }}>
                    회원명 *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    style={{ fontSize: '1.25rem', padding: '1rem' }}
                    required
                  />
                </div>
              ) : (
                <>
                  <div>
                    <label style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.5rem', display: 'block' }}>
                      상호명 *
                    </label>
                    <input
                      type="text"
                      value={formData.companyName}
                      onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                      style={{ fontSize: '1.25rem', padding: '1rem' }}
                      required
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.5rem', display: 'block' }}>
                      담당자명 *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      style={{ fontSize: '1.25rem', padding: '1rem' }}
                      required
                    />
                  </div>
                </>
              )}

              {/* 휴대폰 */}
              <div>
                <label style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.5rem', display: 'block' }}>
                  휴대폰 *
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="010-1234-5678"
                  style={{ fontSize: '1.25rem', padding: '1rem' }}
                  required
                />
              </div>

              {/* 사업자회원 추가 정보 */}
              {accountType === "business" && (
                <>
                  <div style={{ borderTop: '2px solid #e5e7eb', paddingTop: '1.5rem', marginTop: '1rem' }}>
                    <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>
                      사업자 정보
                    </h3>
                  </div>

                  <div>
                    <label style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.5rem', display: 'block' }}>
                      사업자등록번호 *
                    </label>
                    <input
                      type="text"
                      value={formData.businessNumber}
                      onChange={(e) => setFormData({ ...formData, businessNumber: e.target.value })}
                      placeholder="123-45-67890"
                      style={{ fontSize: '1.25rem', padding: '1rem' }}
                      required
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.5rem', display: 'block' }}>
                      대표자명 *
                    </label>
                    <input
                      type="text"
                      value={formData.presidentName}
                      onChange={(e) => setFormData({ ...formData, presidentName: e.target.value })}
                      style={{ fontSize: '1.25rem', padding: '1rem' }}
                      required
                    />
                  </div>
                </>
              )}

              {/* 제출 버튼 */}
              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary"
                style={{
                  fontSize: '1.5rem',
                  padding: '1.25rem',
                  marginTop: '1rem',
                  fontWeight: 'bold'
                }}
              >
                {loading ? "처리 중..." : "회원가입 완료"}
              </button>
            </form>

            <div style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '1.125rem' }}>
              <span style={{ color: '#6b7280' }}>이미 계정이 있으신가요? </span>
              <a href="/login" style={{ color: '#667eea', fontWeight: '600' }}>
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

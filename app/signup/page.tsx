"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type AccountType = "individual" | "business" | null;

export default function SignupPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [accountType, setAccountType] = useState<AccountType>(null);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    passwordConfirm: "",
    name: "",
    companyName: "",
    phone: "",
    businessNumber: "",
    presidentName: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
          email: formData.email,
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
    <main className="min-h-screen bg-gray-50 py-8" style={{ fontSize: '18px' }}>
      <div className="container-sm">
        {/* 진행 단계 표시 */}
        <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '1rem',
            fontSize: '1.5rem',
            fontWeight: 'bold'
          }}>
            <div style={{
              color: step >= 1 ? '#3b82f6' : '#9ca3af',
              opacity: step >= 1 ? 1 : 0.5
            }}>
              1. 회원유형
            </div>
            <div style={{ color: '#9ca3af' }}>→</div>
            <div style={{
              color: step >= 2 ? '#3b82f6' : '#9ca3af',
              opacity: step >= 2 ? 1 : 0.5
            }}>
              2. 정보입력
            </div>
          </div>
        </div>

        {/* STEP 1: 회원 유형 선택 */}
        {step === 1 && (
          <div className="card" style={{ padding: '3rem', textAlign: 'center' }}>
            <h1 style={{ fontSize: '2.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>
              회원가입
            </h1>
            <p style={{ fontSize: '1.25rem', color: '#6b7280', marginBottom: '3rem' }}>
              회원 유형을 선택해주세요
            </p>

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
        )}

        {/* STEP 2: 정보 입력 */}
        {step === 2 && (
          <div className="card" style={{ padding: '2rem' }}>
            <div style={{ marginBottom: '2rem' }}>
              <button
                type="button"
                onClick={() => setStep(1)}
                style={{
                  fontSize: '1.125rem',
                  color: '#6b7280',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '0.5rem'
                }}
              >
                ← 이전
              </button>
            </div>

            <h2 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.5rem', textAlign: 'center' }}>
              {accountType === "individual" ? "개인회원" : "사업자회원"} 정보 입력
            </h2>
            <p style={{ fontSize: '1.125rem', color: '#6b7280', marginBottom: '2rem', textAlign: 'center' }}>
              * 표시는 필수 입력 항목입니다
            </p>

            {error && (
              <div className="alert alert-error" style={{ fontSize: '1.125rem', marginBottom: '1.5rem' }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* 이메일 */}
              <div>
                <label style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.5rem', display: 'block' }}>
                  이메일 *
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  style={{ fontSize: '1.25rem', padding: '1rem' }}
                  required
                />
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
              <a href="/login" style={{ color: '#3b82f6', fontWeight: '600' }}>
                로그인
              </a>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

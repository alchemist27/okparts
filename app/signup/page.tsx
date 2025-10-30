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
  // 사업자등록번호: 000-00-00000 형식
  const bizNum1 = String(randomNum).padStart(3, '1').substring(0, 3);
  const bizNum2 = String(randomNum).padStart(2, '0').substring(0, 2);
  const bizNum3 = String(randomNum).padStart(5, '0');
  return {
    userId: `user${randomNum}`,
    password: password,
    passwordConfirm: password,
    name: `테스터${randomNum}`,
    companyName: `테스트회사${randomNum}`,
    phone: `010-${String(randomNum).padStart(4, '0')}-${String(randomNum).padStart(4, '0')}`,
    businessNumber: `${bizNum1}-${bizNum2}-${bizNum3}`,
    presidentName: `대표${randomNum}`,
  };
}

export default function SignupPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [accountType, setAccountType] = useState<AccountType>(null);
  const [formData, setFormData] = useState({
    userId: "",
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

  // 개발 환경에서만 더미 데이터 자동 입력
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      setFormData(generateDummyData());
    }
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

    // 사업자회원 유효성 검사
    if (accountType === "business") {
      // 사업자등록번호 형식 검사 (XXX-XX-XXXXX)
      const businessNumberPattern = /^\d{3}-\d{2}-\d{5}$/;
      if (!businessNumberPattern.test(formData.businessNumber)) {
        setError("사업자등록번호는 XXX-XX-XXXXX 형식으로 입력해주세요 (예: 118-81-20586)");
        return;
      }

      if (!formData.companyName || formData.companyName.trim() === "") {
        setError("회사명을 입력해주세요");
        return;
      }

      if (!formData.presidentName || formData.presidentName.trim() === "") {
        setError("대표자명을 입력해주세요");
        return;
      }
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
        // 서버 에러 메시지를 더 자세히 표시
        let errorMessage = data.error || "회원가입에 실패했습니다";

        // 카페24 연동 실패 시 상세 정보 추가
        if (data.details) {
          errorMessage += `\n\n상세 정보: ${data.details}`;
        }

        if (data.note) {
          errorMessage += `\n\n${data.note}`;
        }

        throw new Error(errorMessage);
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
            <div className="flex items-center mb-4" style={{ gap: '1rem' }}>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="btn btn-outline primary"
                style={{ padding: '0.5rem 1rem', fontSize: '1rem', flexShrink: 0 }}
              >
                ← 이전
              </button>
              <h2 className="hero-title" style={{ fontSize: '1.5rem', margin: 0, flex: 1, textAlign: 'center' }}>
                {accountType === "individual" ? "개인회원" : "사업자회원"} 정보 입력
              </h2>
            </div>

            <p className="text-center hero-subtitle mb-4" style={{ fontSize: '1rem' }}>
              * 표시는 필수 입력 항목입니다
            </p>

            {/* 에러 메시지 */}
            {error && (
              <div className="alert alert-error mb-4" style={{
                fontSize: '1rem',
                whiteSpace: 'pre-line',
                lineHeight: '1.6'
              }}>
                {error}
              </div>
            )}

            {/* 폼 */}
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* 아이디 */}
              <div>
                <label htmlFor="userId" style={{ fontSize: '1.125rem', fontWeight: '700', marginBottom: '0.5rem', display: 'block' }}>
                  아이디 *
                  <span style={{ fontSize: '0.875rem', fontWeight: '500', color: '#3b82f6', marginLeft: '0.5rem' }}>
                    (영문 소문자와 숫자만 사용 가능, 최소 4자)
                  </span>
                </label>
                <input
                  id="userId"
                  name="userId"
                  type="text"
                  autoComplete="off"
                  inputMode="text"
                  value={formData.userId}
                  onChange={(e) => setFormData({ ...formData, userId: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '') })}
                  onTouchStart={(e) => e.currentTarget.focus()}
                  style={{ fontSize: '1.125rem', padding: '0.875rem', borderRadius: '8px', WebkitUserSelect: 'text', WebkitTouchCallout: 'default' }}
                  placeholder="user1234"
                  required
                  pattern="[a-z0-9]+"
                  minLength={4}
                />
              </div>

              {/* 비밀번호 */}
              <div>
                <label htmlFor="password" style={{ fontSize: '1.125rem', fontWeight: '700', marginBottom: '0.5rem', display: 'block' }}>
                  비밀번호 *
                  <span style={{ fontSize: '0.875rem', fontWeight: '500', color: '#3b82f6', marginLeft: '0.5rem' }}>
                    (영문/숫자/특수문자 조합 최소 6자 이상)
                  </span>
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="off"
                  inputMode="text"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  onTouchStart={(e) => e.currentTarget.focus()}
                  style={{ fontSize: '1.125rem', padding: '0.875rem', borderRadius: '8px', WebkitUserSelect: 'text', WebkitTouchCallout: 'default' }}
                  placeholder="pass1234!@"
                  required
                  minLength={6}
                />
              </div>

              {/* 비밀번호 확인 */}
              <div>
                <label htmlFor="passwordConfirm" style={{ fontSize: '1.125rem', fontWeight: '700', marginBottom: '0.5rem', display: 'block' }}>
                  비밀번호 확인 *
                  <span style={{ fontSize: '0.875rem', fontWeight: '500', color: '#3b82f6', marginLeft: '0.5rem' }}>
                    (위와 동일하게 입력)
                  </span>
                </label>
                <input
                  id="passwordConfirm"
                  name="passwordConfirm"
                  type="password"
                  autoComplete="off"
                  inputMode="text"
                  value={formData.passwordConfirm}
                  onChange={(e) => setFormData({ ...formData, passwordConfirm: e.target.value })}
                  onTouchStart={(e) => e.currentTarget.focus()}
                  style={{ fontSize: '1.125rem', padding: '0.875rem', borderRadius: '8px', WebkitUserSelect: 'text', WebkitTouchCallout: 'default' }}
                  placeholder="pass1234!@"
                  required
                />
              </div>

              {/* 개인회원: 회원명 / 사업자회원: 상호명 */}
              {accountType === "individual" ? (
                <div>
                  <label style={{ fontSize: '1.125rem', fontWeight: '700', marginBottom: '0.5rem', display: 'block' }}>
                    회원명 *
                    <span style={{ fontSize: '0.875rem', fontWeight: '500', color: '#3b82f6', marginLeft: '0.5rem' }}>
                      (실명 또는 사업자명 입력)
                    </span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    onTouchStart={(e) => e.currentTarget.focus()}
                    style={{ fontSize: '1.125rem', padding: '0.875rem', borderRadius: '8px', WebkitUserSelect: 'text', WebkitTouchCallout: 'default' }}
                    placeholder="홍길동"
                    autoComplete="off"
                    inputMode="text"
                    required
                  />
                </div>
              ) : (
                <>
                  <div>
                    <label style={{ fontSize: '1.125rem', fontWeight: '700', marginBottom: '0.5rem', display: 'block' }}>
                      상호명 *
                      <span style={{ fontSize: '0.875rem', fontWeight: '500', color: '#3b82f6', marginLeft: '0.5rem' }}>
                        (사업자등록증의 상호명)
                      </span>
                    </label>
                    <input
                      type="text"
                      value={formData.companyName}
                      onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                      onTouchStart={(e) => e.currentTarget.focus()}
                      style={{ fontSize: '1.125rem', padding: '0.875rem', borderRadius: '8px', WebkitUserSelect: 'text', WebkitTouchCallout: 'default' }}
                      placeholder="OK부품상사"
                      autoComplete="off"
                      inputMode="text"
                      required
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '1.125rem', fontWeight: '700', marginBottom: '0.5rem', display: 'block' }}>
                      담당자명 *
                      <span style={{ fontSize: '0.875rem', fontWeight: '500', color: '#3b82f6', marginLeft: '0.5rem' }}>
                        (거래 및 연락 담당자)
                      </span>
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      onTouchStart={(e) => e.currentTarget.focus()}
                      style={{ fontSize: '1.125rem', padding: '0.875rem', borderRadius: '8px', WebkitUserSelect: 'text', WebkitTouchCallout: 'default' }}
                      placeholder="김담당"
                      autoComplete="off"
                      inputMode="text"
                      required
                    />
                  </div>
                </>
              )}

              {/* 휴대폰 */}
              <div>
                <label style={{ fontSize: '1.125rem', fontWeight: '700', marginBottom: '0.5rem', display: 'block' }}>
                  휴대폰 *
                  <span style={{ fontSize: '0.875rem', fontWeight: '500', color: '#3b82f6', marginLeft: '0.5rem' }}>
                    (하이픈(-) 포함하여 입력)
                  </span>
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  onTouchStart={(e) => e.currentTarget.focus()}
                  placeholder="010-1234-5678"
                  style={{ fontSize: '1.125rem', padding: '0.875rem', borderRadius: '8px', WebkitUserSelect: 'text', WebkitTouchCallout: 'default' }}
                  autoComplete="off"
                  inputMode="tel"
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
                      <span style={{ fontSize: '0.875rem', fontWeight: '500', color: '#3b82f6', marginLeft: '0.5rem' }}>
                        (XXX-XX-XXXXX 형식)
                      </span>
                    </label>
                    <input
                      type="text"
                      value={formData.businessNumber}
                      onChange={(e) => setFormData({ ...formData, businessNumber: e.target.value })}
                      onTouchStart={(e) => e.currentTarget.focus()}
                      placeholder="118-81-20586"
                      style={{ fontSize: '1.125rem', padding: '0.875rem', borderRadius: '8px', WebkitUserSelect: 'text', WebkitTouchCallout: 'default' }}
                      autoComplete="off"
                      inputMode="text"
                      required
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '1.125rem', fontWeight: '700', marginBottom: '0.5rem', display: 'block' }}>
                      대표자명 *
                      <span style={{ fontSize: '0.875rem', fontWeight: '500', color: '#3b82f6', marginLeft: '0.5rem' }}>
                        (사업자등록증의 대표자명)
                      </span>
                    </label>
                    <input
                      type="text"
                      value={formData.presidentName}
                      onChange={(e) => setFormData({ ...formData, presidentName: e.target.value })}
                      onTouchStart={(e) => e.currentTarget.focus()}
                      placeholder="홍대표"
                      style={{ fontSize: '1.125rem', padding: '0.875rem', borderRadius: '8px', WebkitUserSelect: 'text', WebkitTouchCallout: 'default' }}
                      autoComplete="off"
                      inputMode="text"
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
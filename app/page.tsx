import Image from "next/image";

export default function Home() {
  return (
    <main id="main" className="min-h-screen hero flex items-center justify-center">
      <div className="container">
        <div className="hero-card">
          <div className="text-center mb-6">
            <Image
              src="/logo.png"
              alt="OK중고부품"
              width={750}
              height={300}
              priority
              style={{ width: "100%", height: "auto", maxWidth: "420px" }}
            />
          </div>
          <h1 className="text-center mb-2">공급사 상품 등록 시스템</h1>
          <p className="text-center hero-subtitle mb-8">쉽고 빠른 상품 관리 솔루션</p>
          <div className="btn-mobile-stack">
            <a href="/login" className="btn btn-primary btn-xl">로그인</a>
            <a href="/signup" className="btn btn-outline primary btn-xl">회원가입</a>
          </div>

          {/* 테스트 페이지 링크 - 디버깅용 */}
          <div className="text-center" style={{ marginTop: '2rem' }}>
            <a href="/test-keyboard" style={{
              color: '#6b7280',
              fontSize: '1rem',
              textDecoration: 'underline'
            }}>
              🔧 키보드 테스트 페이지
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}

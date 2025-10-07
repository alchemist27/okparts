export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          OKPARTS ADMIN
        </h1>
        <p className="text-gray-600 mb-8">
          오케이중고부품 공급사 상품 등록 시스템
        </p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
          <a href="/login" className="btn btn-primary">
            로그인
          </a>
          <a href="/signup" className="btn btn-secondary">
            회원가입
          </a>
        </div>
      </div>
    </main>
  );
}

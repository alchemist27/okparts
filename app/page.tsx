export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          OKPARTS ADMIN
        </h1>
        <p className="text-gray-600 mb-8">
          오케이중고부품 공급사 상품 등록 시스템
        </p>
        <div className="space-x-4">
          <a
            href="/login"
            className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            로그인
          </a>
          <a
            href="/signup"
            className="inline-block px-6 py-3 bg-gray-200 text-gray-900 rounded-lg hover:bg-gray-300"
          >
            회원가입
          </a>
        </div>
      </div>
    </main>
  );
}

import Image from "next/image";

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center" style={{ background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" }}>
      <div className="w-full max-w-6xl mx-auto px-4 py-8">
        <div className="text-center">
          {/* 로고 */}
          <div className="mb-12 flex justify-center">
            <div className="bg-white rounded-2xl shadow-2xl px-8 py-6 sm:px-12 sm:py-8 md:px-16 md:py-10">
              <Image
                src="/logo.png"
                alt="OK중고부품"
                width={750}
                height={300}
                priority
                style={{ width: "100%", height: "auto", maxWidth: "500px" }}
              />
            </div>
          </div>

          {/* 설명 */}
          <h1 className="text-white text-2xl sm:text-3xl md:text-4xl font-bold mb-4">
            공급사 상품 등록 시스템
          </h1>
          <p className="text-white/90 text-lg sm:text-xl md:text-2xl mb-12">
            쉽고 빠른 상품 관리 솔루션
          </p>

          {/* 버튼 */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center max-w-md mx-auto">
            <a
              href="/login"
              className="btn btn-primary text-xl sm:text-2xl py-4 sm:py-5 px-8 sm:px-12 flex-1 shadow-xl hover:shadow-2xl transition-all"
              style={{ background: "white", color: "#667eea", border: "none" }}
            >
              로그인
            </a>
            <a
              href="/signup"
              className="btn btn-secondary text-xl sm:text-2xl py-4 sm:py-5 px-8 sm:px-12 flex-1 shadow-xl hover:shadow-2xl transition-all"
              style={{ background: "rgba(255,255,255,0.2)", color: "white", border: "2px solid white", backdropFilter: "blur(10px)" }}
            >
              회원가입
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}

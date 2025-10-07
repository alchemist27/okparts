import Image from "next/image";

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="text-center max-w-md w-full">
        {/* 로고 */}
        <div className="mb-8 flex justify-center">
          <Image
            src="/logo.svg"
            alt="OK중고부품"
            width={300}
            height={120}
            priority
            className="w-full max-w-[280px] sm:max-w-[320px] md:max-w-[360px] h-auto"
          />
        </div>

        {/* 설명 */}
        <p className="text-lg sm:text-xl text-gray-700 mb-12 px-4">
          공급사 상품 등록 시스템
        </p>

        {/* 버튼 */}
        <div className="flex flex-col sm:flex-row gap-4 px-4">
          <a
            href="/login"
            className="btn btn-primary flex-1 text-xl py-4 sm:py-5"
          >
            로그인
          </a>
          <a
            href="/signup"
            className="btn btn-secondary flex-1 text-xl py-4 sm:py-5"
          >
            회원가입
          </a>
        </div>
      </div>
    </main>
  );
}

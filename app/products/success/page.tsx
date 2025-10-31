"use client";

import { useRouter } from "next/navigation";
import Image from "next/image";

export default function ProductSuccessPage() {
  const router = useRouter();

  return (
    <main id="main" className="min-h-screen hero flex items-center justify-center py-4">
      <div className="container">
        {/* 로고 */}
        <div className="text-center mb-6">
          <Image
            src="/logo.png"
            alt="OK중고부품"
            width={750}
            height={300}
            priority
            style={{ width: "100%", height: "auto", maxWidth: "280px" }}
          />
        </div>

        <div className="hero-card" style={{ padding: '2rem' }}>
          {/* 성공 아이콘 */}
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <div style={{
              fontSize: '5rem',
              marginBottom: '1rem'
            }}>
              ✅
            </div>
            <h1 className="hero-title" style={{ fontSize: '2rem', marginBottom: '1rem' }}>
              상품 등록이 완료되었습니다
            </h1>
            <p className="hero-subtitle" style={{ fontSize: '1.125rem', color: '#6b7280' }}>
              상품이 성공적으로 등록되었습니다
            </p>
          </div>

          {/* 버튼 그룹 */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            marginTop: '2.5rem'
          }}>
            {/* 대시보드로 돌아가기 */}
            <button
              onClick={() => router.push('/dashboard')}
              className="btn btn-primary btn-xl btn-block"
              style={{ fontSize: '1.25rem' }}
            >
              대시보드로 돌아가기
            </button>

            {/* 다른 상품 등록하기 */}
            <button
              onClick={() => router.push('/products/new')}
              className="btn btn-outline primary btn-xl btn-block"
              style={{ fontSize: '1.25rem' }}
            >
              다른 상품 등록하기
            </button>

            {/* 등록된 상품 보러가기 */}
            <button
              onClick={() => window.location.href = 'https://okayparts.shop'}
              className="btn btn-outline btn-xl btn-block"
              style={{ fontSize: '1.125rem', color: '#6b7280' }}
            >
              등록된 상품 보러가기
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
